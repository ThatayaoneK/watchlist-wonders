import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format, addDays, nextSaturday, nextMonday, isSaturday, isSunday, isMonday } from "date-fns";
import { Loader2 } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { scheduleService } from "@/services/schedules";
import { toast } from "sonner";

function getTonightDate(): Date | null {
  const d = new Date();
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
  const now = new Date();
  const d = isSaturday(now) || isSunday(now) ? now : nextSaturday(now);
  d.setHours(14, 0, 0, 0);
  return d;
}

function getNextWeekDate() {
  const now = new Date();
  const d = isMonday(now) ? now : nextMonday(now);
  d.setHours(20, 0, 0, 0);
  return d;
}

const QUICK_OPTIONS: { label: string; getDate: () => Date | null }[] = [
  { label: "Tonight",      getDate: getTonightDate },
  { label: "Tomorrow",     getDate: getTomorrowDate },
  { label: "This Weekend", getDate: getWeekendDate },
  { label: "Next Week",    getDate: getNextWeekDate },
];

interface QuickReschedulePopoverProps {
  scheduleId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRescheduled: () => void;
  children?: React.ReactNode;
}

export function QuickReschedulePopover({
  scheduleId,
  open,
  onOpenChange,
  onRescheduled,
  children,
}: QuickReschedulePopoverProps) {
  const queryClient = useQueryClient();
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (newDate: Date) => {
      return scheduleService.updateSchedule(scheduleId, {
        scheduled_for: newDate.toISOString(),
        state: 'scheduled',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      toast.success("Rescheduled!");
      onRescheduled();
      setSelectedLabel(null);
    },
    onError: () => {
      toast.error("Could not reschedule.");
      setSelectedLabel(null);
    },
  });

  const handlePick = (label: string, getDate: () => Date | null) => {
    const date = getDate();
    if (!date) return;
    setSelectedLabel(label);
    mutation.mutate(date);
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children ?? <span />}</PopoverTrigger>
      <PopoverContent className="w-56 p-2" side="top" align="start">
        <p className="text-xs font-semibold text-muted-foreground px-1 mb-2 uppercase tracking-wide">
          Reschedule to
        </p>
        <div className="flex flex-col gap-1">
          {QUICK_OPTIONS.map(({ label, getDate }) => {
            const date = getDate();
            const unavailable = !date;
            const isPending = mutation.isPending && selectedLabel === label;
            return (
              <button
                key={label}
                type="button"
                disabled={mutation.isPending || unavailable}
                onClick={() => handlePick(label, getDate)}
                className={cn(
                  "flex items-center justify-between w-full rounded-md px-2 py-1.5 text-sm transition-colors text-left",
                  unavailable
                    ? "opacity-40 cursor-not-allowed text-muted-foreground"
                    : "hover:bg-accent text-foreground"
                )}
              >
                <span>{label}</span>
                {isPending ? (
                  <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                ) : date ? (
                  <span className="text-xs text-muted-foreground">{format(date, "EEE d")}</span>
                ) : null}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
