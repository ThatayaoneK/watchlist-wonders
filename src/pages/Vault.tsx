import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, Unlock, Shield, Globe } from "lucide-react";
import { bookmarkService } from "@/services/bookmarks";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import type { Bookmark } from "@/types/database";

const Vault = () => {
  const [unlocked, setUnlocked] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: bookmarks = [], isLoading } = useQuery({
    queryKey: ["bookmarks"],
    queryFn: () => bookmarkService.getBookmarks(),
  });

  const unvaultMutation = useMutation({
    mutationFn: (bookmarkId: string) => bookmarkService.updateBookmark(bookmarkId, { is_vaulted: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
    },
  });
  const pendingUnvaultId = unvaultMutation.isPending ? unvaultMutation.variables : null;

  const vaulted = bookmarks.filter((bookmark) => bookmark.is_vaulted);

  const handleUnvault = async (bookmark: Bookmark) => {
    try {
      await unvaultMutation.mutateAsync(bookmark.id);
      toast({
        title: "Removed from Vault",
        description: `"${bookmark.title}" is back on your dashboard.`,
      });
    } catch {
      toast({
        title: "Couldn't update vault",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pt-[68px] px-4 sm:px-6 lg:px-8">
        <div className="pt-8 max-w-5xl mx-auto">
          <div className="h-9 w-52 rounded bg-muted animate-pulse mb-4" />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, idx) => (
              <div key={idx} className="aspect-[2/3] rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!unlocked) {
    return (
      <div className="min-h-screen bg-background pt-[68px] px-4 sm:px-6 lg:px-8 flex items-center justify-center">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/15">
            <Shield className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground mb-2">Private Vault</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Your vaulted picks are hidden from the dashboard. Tap to unlock this view.
          </p>
          <Button className="w-full" onClick={() => setUnlocked(true)}>
            <Unlock className="w-4 h-4 mr-2" />
            Tap to Unlock
          </Button>
          <p className="mt-4 text-xs text-muted-foreground">
            {`🔒 ${vaulted.length} item${vaulted.length === 1 ? "" : "s"} in Vault`}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-[68px] px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto pt-6 pb-24">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Vault</h1>
            <p className="text-sm text-muted-foreground">
              Hidden from dashboard by default. Artwork stays blurred in this view.
            </p>
          </div>
          <Button variant="outline" onClick={() => setUnlocked(false)}>
            <Lock className="w-4 h-4 mr-2" />
            Lock Vault
          </Button>
        </div>

        {vaulted.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <p className="text-foreground font-medium">Your Vault is empty.</p>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              Move items here from any card menu with "Move to Vault".
            </p>
            <Button asChild>
              <Link to="/dashboard">Go to Dashboard</Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {vaulted.map((bookmark) => {
              const imageUrl = bookmark.poster_url || bookmark.backdrop_url;
              return (
                <div key={bookmark.id} className="rounded-xl border border-white/10 bg-card overflow-hidden">
                  <Link to={`/b/${bookmark.id}`} className="block relative aspect-[2/3] bg-muted">
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={bookmark.title}
                        className="w-full h-full object-cover scale-110 blur-md"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-muted-foreground/50">
                        {bookmark.title.charAt(0)}
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/25" />
                    {bookmark.is_public && (
                      <div className="absolute top-2 right-2 rounded-full bg-black/70 p-1.5">
                        <Globe className="w-3.5 h-3.5 text-white/90" />
                      </div>
                    )}
                  </Link>
                  <div className="p-3">
                    <p className="text-sm font-medium text-foreground truncate">{bookmark.title}</p>
                    <p className="text-xs text-muted-foreground capitalize mt-0.5">
                      {bookmark.type}
                      {bookmark.release_year ? `, ${bookmark.release_year}` : ""}
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full mt-3"
                      onClick={() => handleUnvault(bookmark)}
                      disabled={pendingUnvaultId === bookmark.id}
                    >
                      <Unlock className="w-3.5 h-3.5 mr-1.5" />
                      Remove from Vault
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Vault;
