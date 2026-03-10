import { Play, Info, Clock, Calendar as CalendarIcon, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GradientBarsBackground } from "@/components/ui/gradient-bars-background";
import { cn } from "@/lib/utils";

interface Bookmark {
  id: string;
  title: string;
  poster_url?: string | null;
  backdrop_url?: string | null;
  runtime_minutes?: number | null;
  release_year?: number | null;
  type: string;
  provider: string;
  source_url?: string | null;
  notes?: string | null;
  mood_tags?: string[];
  scheduled_for?: string | null;
}

interface HeroBannerProps {
  bookmark: Bookmark | null;
  onPlay?: () => void;
  onMoreInfo?: () => void;
  className?: string;
}

export function HeroBanner({ bookmark, onPlay, onMoreInfo, className }: HeroBannerProps) {
  if (!bookmark) {
    return (
      <div className={cn("relative h-[70vh] min-h-[500px] flex items-end pt-16", className)}>
        <GradientBarsBackground className="opacity-60" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
        <div className="relative z-10 container mx-auto px-4 lg:px-8 pb-20">
          <h2 className="text-2xl md:text-5xl font-bold text-foreground mb-4">
            Your Watchlist Awaits
          </h2>
          <p className="text-sm md:text-lg text-muted-foreground max-w-xl mb-6">
            Add your first bookmark to get started. Paste any URL and we'll fetch the details automatically.
          </p>
          <Button variant="default" size="lg" asChild>
            <a href="/new">Add Your First Bookmark</a>
          </Button>
        </div>
      </div>
    );
  }

  const backdropUrl = bookmark.backdrop_url || bookmark.poster_url;

  return (
    <div className={cn("relative h-[70vh] min-h-[500px] flex items-end overflow-hidden pt-16", className)}>
      {/* Backdrop Image */}
      {backdropUrl && (
        <div className="absolute inset-0">
          <img
            src={backdropUrl}
            alt={bookmark.title}
            className="w-full h-full object-cover object-center"
          />
        </div>
      )}

      <GradientBarsBackground baseClassName="bg-transparent" className="opacity-70" />

      {/* Gradient Overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-transparent to-transparent" />

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 lg:px-8 pb-20">
        {/* Badge */}
        <div className="flex items-center gap-2 mb-4">
          {bookmark.scheduled_for && (
            <Badge variant="outline" className="bg-primary/20 border-primary text-primary-foreground">
              <CalendarIcon className="w-3 h-3 mr-1" />
              Next Up
            </Badge>
          )}
          <Badge variant="secondary" className="capitalize">
            {bookmark.type}
          </Badge>
          <Badge variant="outline" className="capitalize">
            {bookmark.provider}
          </Badge>
        </div>

        {/* Title */}
        <h1 className="text-2xl sm:text-4xl md:text-6xl font-bold text-foreground mb-4 max-w-3xl line-clamp-3">
          {bookmark.title}
        </h1>

        {/* Metadata Row */}
        <div className="flex flex-wrap items-center gap-4 text-muted-foreground mb-6">
          {bookmark.release_year && (
            <span className="font-medium">{bookmark.release_year}</span>
          )}
          {bookmark.runtime_minutes && (
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {Math.floor(bookmark.runtime_minutes / 60)}h {bookmark.runtime_minutes % 60}m
            </span>
          )}
          {bookmark.mood_tags && bookmark.mood_tags.length > 0 && (
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 text-primary" />
              <span>{bookmark.mood_tags.slice(0, 2).join(", ")}</span>
            </div>
          )}
        </div>

        {/* Description */}
        {bookmark.notes && (
          <p className="text-sm md:text-lg text-muted-foreground max-w-2xl mb-8 line-clamp-3">
            {bookmark.notes}
          </p>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <Button
            variant="default"
            size="lg"
            onClick={onPlay}
            className="flex items-center gap-2"
          >
            <Play className="w-5 h-5 fill-current" />
            Play
          </Button>
          <Button
            variant="secondary"
            size="lg"
            onClick={onMoreInfo}
            className="flex items-center gap-2"
          >
            <Info className="w-5 h-5" />
            More Info
          </Button>
        </div>
      </div>
    </div>
  );
}
