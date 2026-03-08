import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format, addDays, nextSaturday, nextMonday } from "date-fns";
import { Clock, Loader2, Calendar } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { scheduleService } from "@/services/schedules";
import { toast } from "sonner";
import type { Bookmark } from "@/types/database";

// Quick-pick time slots
function getTonightDate(): Date | null {
  const d = new Date();
  // After 6pm tonight is no longer available (would duplicate Tomorrow)
  if (d.getHours() >= 18) return null;
  d.setHours(20, 0, 0, 0);
  return d;
}

function getTomorrowDate() {
  const d = addDays(new Date(), 1);
  d.setHours(20, 0, 0, 0);
  return d;
}

function getWeekendDate() {
  const d = nextSaturday(new Date());
  d.setHours(14, 0, 0, 0);
  return d;
}

function getNextWeekDate() {
  const d = nextMonday(new Date());
  d.setHours(20, 0, 0, 0);
  return d;
}

const QUICK_OPTIONS: { label: string; getDate: () => Date | null }[] = [
  { label: "Tonight",      getDate: getTonightDate },
  { label: "Tomorrow",     getDate: getTomorrowDate },
  { label: "This Weekend", getDate: getWeekendDate },
  { label: "Next Week",    getDate: getNextWeekDate },
];

const REMINDER_OPTIONS = [
  { value: "15",  label: "15 min before" },
  { value: "30",  label: "30 min before" },
  { value: "60",  label: "1 hour before" },
  { value: "120", label: "2 hours before" },
];

interface QuickScheduleSheetProps {
  bookmark: Bookmark | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScheduled?: () => void;
}

function getLocalDateInputValue(date = new Date()): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().split("T")[0];
}

export function QuickScheduleSheet({
  bookmark,
  open,
  onOpenChange,
  onScheduled,
}: QuickScheduleSheetProps) {
  const queryClient = useQueryClient();
  const [selectedQuick, setSelectedQuick] = useState<string | null>(null);
  const [customDate, setCustomDate] = useState("");
  const [customTime, setCustomTime] = useState("20:00");
  const [reminderOffset, setReminderOffset] = useState("60");
  const [showCustom, setShowCustom] = useState(false);

  const mutation = useMutation({
    mutationFn: async (scheduledFor: Date) => {
      if (!bookmark) throw new Error("No bookmark selected");
      return scheduleService.createSchedule({
        bookmark_id: bookmark.id,
        scheduled_for: scheduledFor.toISOString(),
        reminder_offset_minutes: parseInt(reminderOffset, 10),
        recurrence_type: "none",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      queryClient.invalidateQueries({ queryKey: ["schedules", "upcoming"] });
      queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
      onOpenChange(false);
      onScheduled?.();
      toast.success("Scheduled! You'll get a reminder before it starts.");
      // Reset state
      setSelectedQuick(null);
      setShowCustom(false);
    },
    onError: (err: any) => {
      toast.error(err.message || "Could not create schedule.");
    },
  });

  const handleQuickPick = (label: string, getDate: () => Date | null) => {
    const date = getDate();
    if (!date) return;
    setSelectedQuick(label);
    setShowCustom(false);
    mutation.mutate(date);
  };

  const handleCustomSchedule = () => {
    if (!customDate || !customTime) return;
    const d = new Date(`${customDate}T${customTime}`);
    if (isNaN(d.getTime())) {
      toast.error("Invalid date or time.");
      return;
    }
    if (d <= new Date()) {
      toast.error("Cannot schedule in the past.");
      return;
    }
    mutation.mutate(d);
  };

  const todayStr = getLocalDateInputValue();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] pb-safe">
        <SheetHeader className="mb-6">
          <SheetTitle className="text-left">
            When do you want to watch{bookmark ? ` "${bookmark.title}"` : " this"}?
          </SheetTitle>
          <SheetDescription className="text-left">
            Pick a quick time slot or choose a custom date.
          </SheetDescription>
        </SheetHeader>

        {/* Quick options */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {QUICK_OPTIONS.map(({ label, getDate }) => {
            const date = getDate();
            if (!date) return null;
            const isPending = mutation.isPending && selectedQuick === label;
            return (
              <button
                key={label}
                type="button"
                disabled={mutation.isPending}
                onClick={() => handleQuickPick(label, getDate)}
                className={cn(
                  "flex flex-col items-start gap-1 p-4 rounded-xl border text-left transition-all",
                  selectedQuick === label && mutation.isPending
                    ? "border-primary bg-primary/10"
                    : "border-border bg-wm-surface hover:border-primary/50 hover:bg-wm-surface-hover"
                )}
              >
                <span className="text-sm font-semibold text-foreground">{label}</span>
                <span className="text-xs text-muted-foreground">
                  {isPending ? (
                    <span className="flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Scheduling…
                    </span>
                  ) : (
                    format(date, "EEE, MMM d 'at' h:mm a")
                  )}
                </span>
              </button>
            );
          })}
        </div>

        {/* Reminder selector */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <Label className="text-sm font-medium">Remind me</Label>
          </div>
          <Select value={reminderOffset} onValueChange={setReminderOffset}>
            <SelectTrigger className="h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REMINDER_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Custom date toggle */}
        {!showCustom ? (
          <button
            type="button"
            onClick={() => setShowCustom(true)}
            className="flex items-center gap-2 text-sm text-primary hover:underline mb-2"
          >
            <Calendar className="w-4 h-4" />
            Pick a custom date & time
          </button>
        ) : (
          <div className="space-y-3 pt-4 border-t border-border">
            <p className="text-sm font-medium text-foreground">Custom date & time</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="qs-date" className="text-xs">Date</Label>
                <Input
                  id="qs-date"
                  type="date"
                  min={todayStr}
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="qs-time" className="text-xs">Time</Label>
                <Input
                  id="qs-time"
                  type="time"
                  value={customTime}
                  onChange={(e) => setCustomTime(e.target.value)}
                  className="h-10"
                />
              </div>
            </div>
            <Button
              onClick={handleCustomSchedule}
              disabled={mutation.isPending || !customDate || !customTime}
              className="w-full"
            >
              {mutation.isPending && !selectedQuick ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Scheduling…</>
              ) : "Schedule"}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
