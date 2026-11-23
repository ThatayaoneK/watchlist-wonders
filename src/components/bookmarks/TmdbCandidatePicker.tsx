import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CandidateGrid } from "./CandidateGrid";
import type { EnrichmentMatchCandidate } from "@/lib/enrichmentSmartFill";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  candidates: EnrichmentMatchCandidate[];
  extractedTitle: string;
  onSelect: (candidate: EnrichmentMatchCandidate, rejected: EnrichmentMatchCandidate[]) => void;
  onSkip: () => void;
};

export function TmdbCandidatePicker({
  open,
  onOpenChange,
  candidates,
  extractedTitle,
  onSelect,
  onSkip,
}: Props) {
  const [selectedKey, setSelectedKey] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) setSelectedKey(null);
  }, [open, candidates]);

  const isSingleCandidate = candidates.length === 1;

  const handleConfirm = () => {
    const candidate = candidates.find(
      (c) => `${c.tmdbId}-${c.mediaType}` === selectedKey
    );
    if (!candidate) return;
    const rejected = candidates.filter(
      (c) => `${c.tmdbId}-${c.mediaType}` !== selectedKey
    );
    onSelect(candidate, rejected);
    onOpenChange(false);
  };

  const handleSkip = () => {
    onSkip();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isSingleCandidate ? "Is this the right title?" : "We found possible matches"}
          </DialogTitle>
          <DialogDescription>
            {extractedTitle ? (
              <>
                We searched for{" "}
                <span className="font-medium text-foreground">"{extractedTitle}"</span> — select
                the correct result to auto-fill title, synopsis, runtime, and genre.
              </>
            ) : (
              "Select the correct result to auto-fill title, synopsis, runtime, and genre."
            )}
          </DialogDescription>
        </DialogHeader>

        <CandidateGrid
          candidates={candidates}
          selectedKey={selectedKey}
          onSelect={(c) => setSelectedKey(`${c.tmdbId}-${c.mediaType}`)}
        />

        <div className="flex flex-col gap-2 pt-1">
          <Button onClick={handleConfirm} disabled={selectedKey === null} className="w-full">
            Confirm selection
          </Button>
          <Button variant="ghost" onClick={handleSkip} className="w-full text-muted-foreground">
            None of these — enter manually
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
