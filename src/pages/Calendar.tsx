import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Button } from "@/components/ui/button";
import { TopNav } from "@/components/layout/TopNav";
import { SearchOverlay } from "@/components/search/SearchOverlay";
import { cn } from "@/lib/utils";
import { scheduleService } from "@/services/schedules";
import { bookmarkService } from "@/services/bookmarks";
import { useSearchShortcut } from "@/hooks/useSearchShortcut";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, isToday } from "date-fns";

const ACTIVE_SCHEDULE_STATES = new Set(["scheduled", "snoozed"]);

const Calendar = () => {
  const { isSearchOpen, openSearch, closeSearch } = useSearchShortcut();
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const { data: schedules = [], isLoading } = useQuery({
    queryKey: ['schedules'],
    queryFn: () => scheduleService.getSchedules(),
  });

  const { data: bookmarks = [] } = useQuery({
    queryKey: ['bookmarks'],
    queryFn: () => bookmarkService.getBookmarks(),
  });

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Get the first day of the week for the month start (0 = Sunday)
  const startDayOfWeek = monthStart.getDay();
  
  // Create padding days for the calendar grid
  const paddingDays = Array.from({ length: startDayOfWeek }, (_, i) => null);
  const visibleSchedules = schedules.filter((s) => ACTIVE_SCHEDULE_STATES.has(s.state));
  const upcomingSchedules = visibleSchedules.filter((s) => new Date(s.scheduled_for) >= new Date());

  const getSchedulesForDay = (date: Date) => {
    return visibleSchedules.filter((s) => isSameDay(new Date(s.scheduled_for), date));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <TopNav onSearchClick={openSearch} />
        <div className="flex items-center justify-center pt-32">
          <LoadingSpinner size="lg" />
        </div>
        <SearchOverlay isOpen={isSearchOpen} onClose={closeSearch} bookmarks={[]} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <TopNav onSearchClick={openSearch} />

      <div className="container mx-auto px-4 lg:px-8 pt-20 pb-24 md:pb-16">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Calendar</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">
              View your scheduled watch times
            </p>
          </div>
        </div>

        {/* Calendar Navigation */}
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <h2 className="text-xl font-semibold text-foreground">
            {format(currentMonth, "MMMM yyyy")}
          </h2>
          <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>

        {/* Calendar Grid */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          {/* Day Headers */}
          <div className="grid grid-cols-7 border-b border-border">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div
                key={day}
                className="p-3 text-center text-sm font-medium text-muted-foreground"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7">
            {[...paddingDays, ...daysInMonth].map((day, index) => {
              if (!day) {
                return <div key={`padding-${index}`} className="min-h-[100px] border-b border-r border-border bg-secondary/30" />;
              }

              const daySchedules = getSchedulesForDay(day);
              const isCurrentDay = isToday(day);

              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "min-h-[100px] p-2 border-b border-r border-border transition-colors",
                    isCurrentDay && "bg-primary/5"
                  )}
                >
                  <div className={cn(
                    "text-sm font-medium mb-1",
                    isCurrentDay ? "text-primary" : "text-foreground"
                  )}>
                    {format(day, "d")}
                  </div>
                  
                  {daySchedules.length > 0 && (
                    <div className="space-y-1">
                      {daySchedules.slice(0, 2).map((schedule) => (
                        <div
                          key={schedule.id}
                          className="text-xs p-1.5 bg-primary/10 text-primary rounded truncate"
                        >
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {format(new Date(schedule.scheduled_for), "h:mm a")}
                          </div>
                        </div>
                      ))}
                      {daySchedules.length > 2 && (
                        <div className="text-xs text-muted-foreground">
                          +{daySchedules.length - 2} more
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Upcoming Schedules */}
        <div className="mt-6">
          <h3 className="text-lg font-semibold text-foreground mb-3">Upcoming</h3>
          {upcomingSchedules.length === 0 ? (
            <div className="text-center py-8 bg-card border border-border rounded-lg">
              <CalendarIcon className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">No upcoming schedules</p>
              <p className="text-sm text-muted-foreground mt-1">
                Schedule a bookmark from the dashboard to see it here
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {upcomingSchedules
                .slice(0, 5)
                .map((schedule) => (
                  <div
                    key={schedule.id}
                    className="flex items-center gap-4 p-4 bg-card border border-border rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-foreground">
                        {schedule.bookmarks?.title ?? "Untitled"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(schedule.scheduled_for), "EEEE, MMMM d")}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(schedule.scheduled_for), "h:mm a")}
                      </p>
                    </div>
                    <div className="text-sm text-muted-foreground capitalize">
                      {schedule.state}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
      
      <SearchOverlay
        isOpen={isSearchOpen}
        onClose={closeSearch}
        bookmarks={bookmarks}
      />
    </div>
  );
};

export default Calendar;
