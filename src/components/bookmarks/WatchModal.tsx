import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { buildFallbackSearchUrls } from "@/services/watchAvailability";
import type { Bookmark } from "@/types/database";

interface WatchModalProps {
  bookmark: Bookmark;
  open: boolean;
  onClose: () => void;
}

function isSafeUrl(url: string): boolean {
  try {
    const { protocol } = new URL(url);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}

function openSafe(url: string) {
  if (isSafeUrl(url)) window.open(url, "_blank", "noopener,noreferrer");
}

export function WatchModal({ bookmark, open, onClose }: WatchModalProps) {
  const safeTitle = (bookmark.title || "Untitled").trim() || "Untitled";
  const providers = bookmark.availability?.providers ?? [];
  const region = bookmark.availability?.region;
  const fallback = buildFallbackSearchUrls(safeTitle);

  const subscription = providers.filter((p) => p.type === "subscription");
  const rent = providers.filter((p) => p.type === "rent");
  const buy = providers.filter((p) => p.type === "buy");

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{safeTitle}</DialogTitle>
          <DialogDescription>
            Where you can watch{region ? ` (${region})` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {subscription.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Included with subscription
              </p>
              {subscription.map((p) => (
                <div
                  key={`${p.name}-sub`}
                  className="flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {p.logoUrl && (
                      <img src={p.logoUrl} alt={p.name} className="w-5 h-5 rounded-sm shrink-0" />
                    )}
                    <span className="text-sm truncate">{p.name}</span>
                  </div>
                  <Button size="sm" onClick={() => openSafe(p.url)} className="gap-1 shrink-0">
                    <ExternalLink className="w-3 h-3" />
                    Watch
                  </Button>
                </div>
              ))}
            </div>
          )}

          {rent.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Rent
              </p>
              {rent.map((p) => (
                <div
                  key={`${p.name}-rent`}
                  className="flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {p.logoUrl && (
                      <img src={p.logoUrl} alt={p.name} className="w-5 h-5 rounded-sm shrink-0" />
                    )}
                    <span className="text-sm truncate">{p.name}</span>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => openSafe(p.url)} className="gap-1 shrink-0">
                    <ExternalLink className="w-3 h-3" />
                    Rent
                  </Button>
                </div>
              ))}
            </div>
          )}

          {buy.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Buy
              </p>
              {buy.map((p) => (
                <div
                  key={`${p.name}-buy`}
                  className="flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {p.logoUrl && (
                      <img src={p.logoUrl} alt={p.name} className="w-5 h-5 rounded-sm shrink-0" />
                    )}
                    <span className="text-sm truncate">{p.name}</span>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => openSafe(p.url)} className="gap-1 shrink-0">
                    <ExternalLink className="w-3 h-3" />
                    Buy
                  </Button>
                </div>
              ))}
            </div>
          )}

          {providers.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Not available on major platforms in your region right now.
            </p>
          )}

          <div className="space-y-2 pt-1 border-t border-border/50">
            <p className="text-[11px] text-muted-foreground/70 uppercase tracking-wide">
              Can't find it above? Search
            </p>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => openSafe(fallback.google)}
                className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
              >
                Google
              </button>
              <span className="text-muted-foreground/40 text-xs">·</span>
              <button
                type="button"
                onClick={() => openSafe(fallback.youtube)}
                className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
              >
                YouTube
              </button>
              <span className="text-muted-foreground/40 text-xs">·</span>
              <button
                type="button"
                onClick={() => openSafe(fallback.web)}
                className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
              >
                Web search
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
