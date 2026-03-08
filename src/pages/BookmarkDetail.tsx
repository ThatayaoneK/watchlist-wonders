import { useState, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Play, Check, Trash2, Edit2,
  Clock, Tag, ExternalLink, Save, X,
  Paperclip, FileText, Download, Upload, Loader2, Star,
  Share2, Globe, Lock, Copy, Tv, Plus, Shuffle,
} from "lucide-react";
import { useWatchProviders } from "@/hooks/useWatchProviders";
import { useSimilarTitles } from "@/hooks/useSimilarTitles";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { sharingService } from "@/services/sharing";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { bookmarkService } from "@/services/bookmarks";
import { attachmentService } from "@/services/attachments";
import { useToast } from "@/hooks/use-toast";
import { formatRuntime, getMoodEmoji } from "@/lib/utils";
import type { Bookmark } from "@/types/database";

const STATUS_OPTIONS: { value: Bookmark["status"]; label: string }[] = [
  { value: "backlog", label: "Backlog" },
  { value: "watching", label: "Watching" },
  { value: "done", label: "Done" },
  { value: "dropped", label: "Dropped" },
];

const BookmarkDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [deletingAttachmentId, setDeletingAttachmentId] = useState<string | null>(null);
  const attachFileRef = useRef<HTMLInputElement>(null);

  // Edit form state
  const [editTitle, setEditTitle] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editStatus, setEditStatus] = useState<Bookmark["status"]>("backlog");

  const { data: bookmark, isLoading, error } = useQuery({
    queryKey: ['bookmark', id],
    queryFn: () => bookmarkService.getBookmark(id!),
    enabled: !!id,
  });

  const { data: attachments = [], refetch: refetchAttachments } = useQuery({
    queryKey: ['attachments', id],
    queryFn: () => attachmentService.getAttachments(id!),
    enabled: !!id,
  });

  const deleteAttachmentMutation = useMutation({
    mutationFn: (attachmentId: string) => attachmentService.deleteAttachment(attachmentId),
    onSuccess: () => {
      setDeletingAttachmentId(null);
      refetchAttachments();
      toast({ title: "Attachment deleted" });
    },
    onError: () => {
      setDeletingAttachmentId(null);
      toast({
        title: "Failed to delete attachment",
        description: "Could not delete the attachment. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleAttachFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;
    try {
      await attachmentService.createAttachment(file, id);
      refetchAttachments();
      toast({ title: "Attachment uploaded", description: file.name });
    } catch (err: any) {
      toast({ title: "Upload failed", description: "Could not upload the file. Please try again.", variant: "destructive" });
    }
    // Reset file input
    if (attachFileRef.current) attachFileRef.current.value = "";
  };

  const updateMutation = useMutation({
    mutationFn: (updates: Partial<Bookmark>) => bookmarkService.updateBookmark(id!, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookmark', id] });
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
      setIsEditing(false);
      toast({
        title: "Bookmark updated",
        description: "Your changes have been saved.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error updating bookmark",
        description: "Could not update the bookmark. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => bookmarkService.deleteBookmark(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
      toast({
        title: "Bookmark deleted",
        description: "The bookmark has been removed.",
      });
      navigate("/dashboard");
    },
  });

  const makePublicMutation = useMutation({
    mutationFn: () => sharingService.makeBookmarkPublic(id!),
    onSuccess: (token) => {
      queryClient.invalidateQueries({ queryKey: ['bookmark', id] });
      const shareUrl = `${window.location.origin}/share/${token}`;
      navigator.clipboard.writeText(shareUrl).catch(() => {});
      toast({ title: "Share link copied!", description: shareUrl });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to share bookmark",
        description: "Could not create the share link. Please try again.",
        variant: "destructive",
      });
    },
  });

  const makePrivateMutation = useMutation({
    mutationFn: () => sharingService.makeBookmarkPrivate(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookmark', id] });
      toast({ title: "Sharing disabled" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to disable sharing",
        description: "Could not disable sharing. Please try again.",
        variant: "destructive",
      });
    },
  });

  const rateMutation = useMutation({
    mutationFn: ({ rating, review }: { rating: number | null; review?: string | null }) =>
      bookmarkService.rateBookmark(id!, rating, review),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookmark', id] });
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
    },
    onError: (error: any) => {
      toast({ title: "Failed to save rating", description: "Could not save your rating. Please try again.", variant: "destructive" });
    },
  });

  const addSimilarMutation = useMutation({
    mutationFn: (item: { id: number; title: string; posterUrl: string | null; release_year: number | null; media_type: 'movie' | 'tv' }) =>
      bookmarkService.createBookmark({
        title: item.title,
        type: item.media_type === 'tv' ? 'series' : 'movie',
        provider: 'tmdb',
        poster_url: item.posterUrl,
        release_year: item.release_year,
        metadata: { tmdb_id: item.id },
      }),
    onSuccess: (newBm) => {
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
      toast({ title: "Added to watchlist", description: newBm.title });
    },
    onError: (error: any) => {
      toast({ title: "Failed to add", description: "Could not add to watchlist. Please try again.", variant: "destructive" });
    },
  });

  const handleStartEdit = () => {
    if (bookmark) {
      setEditTitle(bookmark.title);
      setEditNotes(bookmark.notes || "");
      setEditStatus(bookmark.status);
      setIsEditing(true);
    }
  };

  const handleSaveEdit = () => {
    updateMutation.mutate({
      title: editTitle,
      notes: editNotes || null,
      status: editStatus,
    });
  };

  const handleStatusChange = (status: Bookmark["status"]) => {
    updateMutation.mutate({ status });
  };

  // Handle both camelCase (tmdbId) and snake_case (tmdb_id) — legacy data may differ
  const tmdbId = (bookmark?.metadata?.tmdb_id ?? bookmark?.metadata?.tmdbId) as number | string | undefined;
  const { data: watchProviders } = useWatchProviders(tmdbId, bookmark?.type || 'movie');
  const { data: similarTitles = [] } = useSimilarTitles(tmdbId, bookmark?.type || 'movie');

  // IDs already in the user's bookmarks (for duplicate guard on similar titles)
  const { data: allBookmarks = [] } = useQuery({
    queryKey: ['bookmarks'],
    queryFn: () => bookmarkService.getBookmarks(),
    staleTime: 60 * 1000,
  });
  const ownedTmdbIds = new Set(
    allBookmarks
      .map((b) => {
        const id = b.metadata?.tmdb_id ?? b.metadata?.tmdbId;
        return typeof id === 'string' ? parseInt(id, 10) : id;
      })
      .filter((id) => typeof id === 'number' && !isNaN(id))
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !bookmark) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <p className="text-destructive mb-4">Bookmark not found</p>
        <Button onClick={() => navigate("/dashboard")}>Back to Dashboard</Button>
      </div>
    );
  }

  const imageUrl = bookmark.backdrop_url
    || (bookmark.metadata?.backdrop_url as string | undefined)
    || bookmark.poster_url;
  const voteAverage = bookmark.metadata?.vote_average as number | undefined;

  return (
    <div className="min-h-screen bg-background">
      {/* Hero/Backdrop */}
      <div className="relative h-[40vh] md:h-[50vh] bg-secondary">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={bookmark.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-8xl font-bold text-muted-foreground">
              {bookmark.title.charAt(0)}
            </span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
        
        {/* Back Button */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-4 left-4 bg-background/80 backdrop-blur focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => navigate(-1)}
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>

        {/* Actions */}
        <div className="absolute top-4 right-4 flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="bg-background/80 backdrop-blur focus-visible:ring-2 focus-visible:ring-ring"
            onClick={handleStartEdit}
            aria-label="Edit bookmark"
          >
            <Edit2 className="w-5 h-5" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="bg-background/80 backdrop-blur text-destructive hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Delete bookmark"
              >
                <Trash2 className="w-5 h-5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete bookmark?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete "{bookmark.title}" from your watchlist. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteMutation.mutate()}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 lg:px-8 -mt-32 relative z-10 pb-16">
        <div className="max-w-3xl">
          {isEditing ? (
            // Edit Mode
            <div className="bg-card border border-border rounded-lg p-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-title">Title</Label>
                <Input
                  id="edit-title"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-status">Status</Label>
                <Select value={editStatus} onValueChange={(v) => setEditStatus(v as Bookmark["status"])}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-notes">Notes</Label>
                <Textarea
                  id="edit-notes"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={4}
                />
              </div>
              <div className="flex gap-2 pt-4">
                <Button onClick={handleSaveEdit} disabled={updateMutation.isPending}>
                  <Save className="w-4 h-4 mr-2" />
                  Save
                </Button>
                <Button variant="ghost" onClick={() => setIsEditing(false)}>
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            // View Mode
            <>
              <h1 className="text-4xl font-bold text-foreground mb-4">{bookmark.title}</h1>

              {/* Meta Info */}
              <div className="flex flex-wrap items-center gap-3 text-muted-foreground mb-6">
                <span className="capitalize">{bookmark.type}</span>
                <span>•</span>
                <span className="capitalize">{bookmark.provider}</span>
                {bookmark.release_year && (
                  <>
                    <span>•</span>
                    <span>{bookmark.release_year}</span>
                  </>
                )}
                {bookmark.runtime_minutes && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {formatRuntime(bookmark.runtime_minutes)}
                    </span>
                  </>
                )}
                {voteAverage != null && voteAverage > 0 && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1 text-yellow-500 font-medium">
                      <Star className="w-4 h-4 fill-yellow-500" />
                      {voteAverage.toFixed(1)}
                    </span>
                  </>
                )}
              </div>

              {/* Status Badge */}
              <div className="mb-6">
                <Select value={bookmark.status} onValueChange={handleStatusChange}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-3 mb-8">
                {bookmark.source_url && (
                  <Button onClick={() => window.open(bookmark.source_url!, "_blank")}>
                    <Play className="w-4 h-4 mr-2 fill-current" />
                    Watch Now
                  </Button>
                )}
                <Button
                  variant="secondary"
                  onClick={() => handleStatusChange("done")}
                  disabled={bookmark.status === "done"}
                >
                  <Check className="w-4 h-4 mr-2" />
                  Mark as Done
                </Button>
              </div>

              {/* Mood Tags */}
              {bookmark.mood_tags && bookmark.mood_tags.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Mood</h3>
                  <div className="flex flex-wrap gap-2">
                    {bookmark.mood_tags.map((mood) => (
                      <Badge key={mood} variant="outline">
                        {getMoodEmoji(mood)} {mood}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Tags */}
              {bookmark.tags && bookmark.tags.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {bookmark.tags.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        <Tag className="w-3 h-3 mr-1" />
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              {bookmark.notes && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Notes</h3>
                  <p className="text-foreground whitespace-pre-wrap">{bookmark.notes}</p>
                </div>
              )}

              {/* Personal Rating */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1">
                  <Star className="w-4 h-4" />
                  My Rating
                </h3>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => rateMutation.mutate({
                        rating: bookmark.user_rating === star ? null : star,
                      })}
                      className="p-0.5 hover:scale-110 transition-transform"
                      aria-label={`Rate ${star} star${star !== 1 ? 's' : ''}`}
                    >
                      <Star
                        className={`w-6 h-6 ${
                          (bookmark.user_rating || 0) >= star
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'text-muted-foreground'
                        }`}
                      />
                    </button>
                  ))}
                  {bookmark.user_rating && (
                    <span className="text-sm text-muted-foreground ml-2">
                      {bookmark.user_rating}/5
                    </span>
                  )}
                </div>
              </div>

              {/* Where to Watch */}
              {watchProviders && (
                (watchProviders.flatrate.length > 0 || watchProviders.rent.length > 0 || watchProviders.buy.length > 0)
              ) && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-1">
                    <Tv className="w-4 h-4" />
                    Where to Watch
                  </h3>
                  <div className="space-y-3">
                    {watchProviders!.flatrate.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1.5">Stream</p>
                        <div className="flex flex-wrap gap-2">
                          {watchProviders!.flatrate.map((p) => (
                            <div key={p.provider_id} className="flex items-center gap-1.5 bg-secondary rounded-lg px-2 py-1.5" title={p.provider_name}>
                              <img src={p.logoUrl} alt={p.provider_name} className="w-5 h-5 rounded" />
                              <span className="text-xs">{p.provider_name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {watchProviders!.rent.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1.5">Rent</p>
                        <div className="flex flex-wrap gap-2">
                          {watchProviders!.rent.map((p) => (
                            <div key={p.provider_id} className="flex items-center gap-1.5 bg-secondary rounded-lg px-2 py-1.5" title={p.provider_name}>
                              <img src={p.logoUrl} alt={p.provider_name} className="w-5 h-5 rounded" />
                              <span className="text-xs">{p.provider_name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {watchProviders!.buy.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1.5">Buy</p>
                        <div className="flex flex-wrap gap-2">
                          {watchProviders!.buy.map((p) => (
                            <div key={p.provider_id} className="flex items-center gap-1.5 bg-secondary rounded-lg px-2 py-1.5" title={p.provider_name}>
                              <img src={p.logoUrl} alt={p.provider_name} className="w-5 h-5 rounded" />
                              <span className="text-xs">{p.provider_name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {watchProviders!.link && (
                      <a
                        href={watchProviders!.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        View all options on JustWatch
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Source Link */}
              {bookmark.source_url && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Source</h3>
                  <a
                    href={bookmark.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline flex items-center gap-1"
                  >
                    <ExternalLink className="w-4 h-4" />
                    {bookmark.source_url}
                  </a>
                </div>
              )}

              {/* Sharing */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1">
                  <Share2 className="w-4 h-4" />
                  Sharing
                </h3>
                {bookmark.is_public && bookmark.share_token ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="gap-1">
                      <Globe className="w-3 h-3" />
                      Public
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => {
                        const url = `${window.location.origin}/share/${bookmark.share_token}`;
                        navigator.clipboard.writeText(url).catch(() => {});
                        toast({ title: "Link copied!" });
                      }}
                    >
                      <Copy className="w-3 h-3 mr-1" />
                      Copy link
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-muted-foreground"
                      onClick={() => makePrivateMutation.mutate()}
                      disabled={makePrivateMutation.isPending}
                    >
                      <Lock className="w-3 h-3 mr-1" />
                      Make private
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => makePublicMutation.mutate()}
                    disabled={makePublicMutation.isPending}
                  >
                    <Globe className="w-4 h-4 mr-2" />
                    Make public & copy link
                  </Button>
                )}
              </div>

              {/* Attachments */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                    <Paperclip className="w-4 h-4" />
                    Attachments {attachments.length > 0 && `(${attachments.length})`}
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => attachFileRef.current?.click()}
                  >
                    <Upload className="w-3 h-3 mr-1" />
                    Add
                  </Button>
                  <input
                    ref={attachFileRef}
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={handleAttachFile}
                  />
                </div>
                {attachments.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => attachFileRef.current?.click()}
                    className="w-full border border-dashed border-border rounded-lg p-4 text-center text-sm text-muted-foreground hover:border-primary/50 transition-colors"
                  >
                    No attachments yet — click to upload
                  </button>
                ) : (
                  <div className="space-y-2">
                    {attachments.map((att) => (
                      <div
                        key={att.id}
                        className="flex items-center gap-3 p-3 bg-secondary rounded-lg"
                      >
                        {att.file_type?.startsWith("image/") ? (
                          <img
                            src={att.file_url}
                            alt={att.file_name}
                            className="w-10 h-10 object-cover rounded"
                          />
                        ) : (
                          <FileText className="w-8 h-8 text-muted-foreground shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{att.file_name}</p>
                          {att.size && (
                            <p className="text-xs text-muted-foreground">
                              {(att.size / 1024).toFixed(1)} KB
                            </p>
                          )}
                        </div>
                        <a
                          href={att.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 hover:bg-background rounded transition-colors"
                          title="Download"
                        >
                          <Download className="w-4 h-4 text-muted-foreground" />
                        </a>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => { setDeletingAttachmentId(att.id); deleteAttachmentMutation.mutate(att.id); }}
                          disabled={deletingAttachmentId === att.id}
                        >
                          {deletingAttachmentId === att.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <X className="w-3 h-3" />
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {/* Similar Titles */}
              {similarTitles.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-1">
                    <Shuffle className="w-4 h-4" />
                    You Might Also Like
                  </h3>
                  <div className="flex gap-3 overflow-x-auto pb-2 hide-scrollbar">
                    {similarTitles.map((item) => {
                      const alreadyOwned = ownedTmdbIds.has(item.id);
                      return (
                        <div key={item.id} className="shrink-0 w-28 group">
                          <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-secondary mb-1.5">
                            {item.posterUrl ? (
                              <img
                                src={item.posterUrl}
                                alt={item.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <span className="text-2xl font-bold text-muted-foreground">{item.title.charAt(0)}</span>
                              </div>
                            )}
                            {!alreadyOwned && (
                              <button
                                type="button"
                                onClick={() => addSimilarMutation.mutate(item)}
                                disabled={addSimilarMutation.isPending}
                                className="absolute inset-0 bg-background/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                                aria-label={`Add ${item.title} to watchlist`}
                              >
                                <Plus className="w-6 h-6 text-primary" />
                              </button>
                            )}
                            {alreadyOwned && (
                              <div className="absolute top-1 right-1 bg-primary rounded-full p-0.5">
                                <Check className="w-3 h-3 text-primary-foreground" />
                              </div>
                            )}
                          </div>
                          <p className="text-xs text-foreground truncate">{item.title}</p>
                          {item.release_year && (
                            <p className="text-[10px] text-muted-foreground">{item.release_year}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default BookmarkDetail;
