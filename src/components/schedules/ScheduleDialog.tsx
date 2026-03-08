import { useState } from "react";
import { addDays, addWeeks, addMonths } from "date-fns";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { scheduleService } from "@/services/schedules";
import type { Bookmark } from "@/types/database";

interface ScheduleDialogProps {
  bookmark: Bookmark | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScheduled?: () => void;
}

type Recurrence = 'none' | 'daily' | 'weekly' | 'monthly';

function getLocalDateInputValue(date = new Date()): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().split("T")[0];
}

export function ScheduleDialog({ bookmark, open, onOpenChange, onScheduled }: ScheduleDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const today = getLocalDateInputValue();
  const [scheduleDate, setScheduleDate] = useState(today);
  const [scheduleTime, setScheduleTime] = useState("20:00");
  const [reminderOffset, setReminderOffset] = useState("60");
  const [recurrence, setRecurrence] = useState<Recurrence>("none");

  const mutation = useMutation({
    mutationFn: async () => {
      if (!bookmark) throw new Error("No bookmark selected");
      if (!scheduleDate || !scheduleTime) throw new Error("Date and time are required");
      const baseDate = new Date(`${scheduleDate}T${scheduleTime}`);
      if (isNaN(baseDate.getTime())) throw new Error("Invalid date or time");
      if (baseDate <= new Date()) throw new Error("Cannot schedule in the past.");

      // Create the primary schedule
      const primary = await scheduleService.createSchedule({
        bookmark_id: bookmark.id,
        scheduled_for: baseDate.toISOString(),
        reminder_offset_minutes: parseInt(reminderOffset, 10),
        recurrence_type: recurrence,
      });

      // Create 3 additional occurrences for recurring schedules
      if (recurrence !== 'none') {
        const dates: Date[] = [];
        for (let i = 1; i <= 3; i++) {
          if (recurrence === 'daily') dates.push(addDays(baseDate, i));
          else if (recurrence === 'weekly') dates.push(addWeeks(baseDate, i));
          else if (recurrence === 'monthly') dates.push(addMonths(baseDate, i));
        }
        const results = await Promise.allSettled(
          dates.map((d) =>
            scheduleService.createSchedule({
              bookmark_id: bookmark.id,
              scheduled_for: d.toISOString(),
              reminder_offset_minutes: parseInt(reminderOffset, 10),
              recurrence_type: recurrence,
            })
          )
        );
        const fulfilled = results.filter(
          (r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof scheduleService.createSchedule>>> =>
            r.status === 'fulfilled'
        );
        const rejected = results.filter((r) => r.status === 'rejected');
        if (rejected.length > 0) {
          // Rollback: delete the primary and any successfully created recurring schedules
          const idsToDelete = [primary.id, ...fulfilled.map((r) => r.value.id)];
          const rollbackResults = await Promise.allSettled(
            idsToDelete.map((id) => scheduleService.deleteSchedule(id))
          );
          const failedRollbackIds = rollbackResults
            .map((r, i) => ({ result: r, id: idsToDelete[i] }))
            .filter(({ result }) => result.status === 'rejected')
            .map(({ id }) => id);
          if (failedRollbackIds.length > 0) {
            console.error('Rollback failed for schedule IDs:', failedRollbackIds);
            throw new Error(
              `Failed to create ${rejected.length} recurring schedule(s). Partial rollback: ${failedRollbackIds.length} deletion(s) failed (IDs: ${failedRollbackIds.join(', ')}).`
            );
          }
          throw new Error(
            `Failed to create ${rejected.length} recurring schedule(s). All changes rolled back.`
          );
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      queryClient.invalidateQueries({ queryKey: ['schedules', 'upcoming'] });
      onOpenChange(false);
      onScheduled?.();
      const recurrenceLabel = recurrence !== 'none' ? ` (+ 3 more ${recurrence})` : '';
      toast({
        title: "Scheduled!",
        description: `Added to your calendar${recurrenceLabel}.`,
      });
    },
    onError: (error: any) => {
      // Surface our own validation messages; use a safe fallback for Firestore errors (which carry error.code)
      const description = !error.code && error.message
        ? error.message
        : "Could not create the schedule. Please try again.";
      toast({
        title: "Error scheduling",
        description,
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Schedule "{bookmark?.title ?? 'Untitled'}"</DialogTitle>
          <DialogDescription>Pick a date, time, and recurrence.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sched-date">Date</Label>
              <Input
                id="sched-date"
                type="date"
                min={today}
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sched-time">Time</Label>
              <Input
                id="sched-time"
                type="time"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Reminder</Label>
            <Select value={reminderOffset} onValueChange={setReminderOffset}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15">15 minutes before</SelectItem>
                <SelectItem value="30">30 minutes before</SelectItem>
                <SelectItem value="60">1 hour before</SelectItem>
                <SelectItem value="120">2 hours before</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Repeat</Label>
            <Select value={recurrence} onValueChange={(v) => setRecurrence(v as Recurrence)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No repeat</SelectItem>
                <SelectItem value="daily">Daily (next 4 days)</SelectItem>
                <SelectItem value="weekly">Weekly (next 4 weeks)</SelectItem>
                <SelectItem value="monthly">Monthly (next 4 months)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending || !scheduleDate || !scheduleTime}
            >
              {mutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Scheduling...</>
              ) : "Schedule"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
