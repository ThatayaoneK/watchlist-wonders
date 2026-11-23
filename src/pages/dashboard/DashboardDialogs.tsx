import { useNavigate } from "react-router-dom";
import { DecisionMode } from "@/components/bookmarks/DecisionMode";
import { CompletionSheet } from "@/components/bookmarks/CompletionSheet";
import { ScheduleDialog } from "@/components/schedules/ScheduleDialog";
import { WelcomeFlow, type OnboardingSuggestion } from "@/components/onboarding/WelcomeFlow";
import { DashboardTour } from "@/components/onboarding/DashboardTour";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Bookmark } from "@/types/database";

type DecisionIntentSeed = "quick" | "deep" | "random" | "continue";

interface WatchPlan {
  id: string;
  name: string;
}

interface DashboardDialogsProps {
  // Decision Mode
  decisionModeOpen: boolean;
  decisionSeedIntent: DecisionIntentSeed | null;
  visibleBookmarks: Bookmark[];
  onCloseDecisionMode: () => void;

  // Schedule Dialog
  scheduleOpen: boolean;
  selectedBookmark: Bookmark | null;
  onScheduleOpenChange: (open: boolean) => void;

  // Plan Dialog
  planOpen: boolean;
  plans: WatchPlan[];
  selectedPlanId: string;
  addToPlanIsPending: boolean;
  onPlanOpenChange: (open: boolean) => void;
  onPlanSelectChange: (value: string) => void;
  onAddToPlanSubmit: () => void;

  // Completion Sheet
  completionSheetOpen: boolean;
  completionBookmark: Bookmark | null;
  bestNextItem: Bookmark | null;
  nextReason: string | undefined;
  streakCount: number;
  onCompletionOpenChange: (open: boolean) => void;
  onRate: (id: string, rating: number | undefined, review?: string, watchedWith?: string | null) => void;
  onPlayNext?: () => void;
  onScheduleNext?: () => void;

  // Welcome Flow
  shouldShowWelcomeFlow: boolean;
  onWelcomeDismiss: () => void;
  onWelcomeSuggestionAdd: (suggestion: OnboardingSuggestion) => Promise<void>;
  onWelcomeComplete: (payload: {
    genres: string[];
    providers: string[];
    addedSuggestionIds: string[];
  }) => Promise<void>;

  // Tour
  showTour: boolean;
  demoActive: boolean;
  onDismissTour: () => void;
}

export function DashboardDialogs({
  decisionModeOpen,
  decisionSeedIntent,
  visibleBookmarks,
  onCloseDecisionMode,
  scheduleOpen,
  selectedBookmark,
  onScheduleOpenChange,
  planOpen,
  plans,
  selectedPlanId,
  addToPlanIsPending,
  onPlanOpenChange,
  onPlanSelectChange,
  onAddToPlanSubmit,
  completionSheetOpen,
  completionBookmark,
  bestNextItem,
  nextReason,
  streakCount,
  onCompletionOpenChange,
  onRate,
  onPlayNext,
  onScheduleNext,
  shouldShowWelcomeFlow,
  onWelcomeDismiss,
  onWelcomeSuggestionAdd,
  onWelcomeComplete,
  showTour,
  demoActive,
  onDismissTour,
}: DashboardDialogsProps) {
  const navigate = useNavigate();

  return (
    <>
      <DecisionMode
        open={decisionModeOpen}
        onClose={onCloseDecisionMode}
        bookmarks={visibleBookmarks}
        initialIntent={decisionSeedIntent}
      />

      <ScheduleDialog
        bookmark={selectedBookmark}
        open={scheduleOpen}
        onOpenChange={(open) => {
          onScheduleOpenChange(open);
        }}
      />

      <Dialog open={planOpen} onOpenChange={onPlanOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to Watch Plan</DialogTitle>
            <DialogDescription>
              Choose a plan to add &ldquo;{selectedBookmark?.title}&rdquo; to.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {plans.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-muted-foreground mb-4">No watch plans yet</p>
                <Button onClick={() => { onPlanOpenChange(false); navigate("/plans"); }}>
                  Create a Plan
                </Button>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="plan-select">Select Plan</Label>
                  <Select value={selectedPlanId} onValueChange={onPlanSelectChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a plan..." />
                    </SelectTrigger>
                    <SelectContent>
                      {plans.map((plan) => (
                        <SelectItem key={plan.id} value={plan.id}>
                          {plan.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="ghost" onClick={() => onPlanOpenChange(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={onAddToPlanSubmit}
                    disabled={addToPlanIsPending || !selectedPlanId}
                  >
                    {addToPlanIsPending ? "Adding..." : "Add to Plan"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <CompletionSheet
        bookmark={completionBookmark}
        open={completionSheetOpen}
        onOpenChange={onCompletionOpenChange}
        onRate={(id, rating, review, watchedWith) => onRate(id, rating, review, watchedWith)}
        onSkip={() => onCompletionOpenChange(false)}
        nextSuggestion={bestNextItem}
        nextReason={nextReason}
        streakCount={streakCount}
        onPlayNext={onPlayNext}
        onScheduleNext={onScheduleNext}
      />

      <WelcomeFlow
        open={shouldShowWelcomeFlow}
        onDismiss={onWelcomeDismiss}
        onAddSuggestion={onWelcomeSuggestionAdd}
        onComplete={onWelcomeComplete}
      />

      <DashboardTour
        open={!demoActive && !shouldShowWelcomeFlow && showTour}
        onDismiss={onDismissTour}
        onFinish={onDismissTour}
      />
    </>
  );
}
