import { useState } from "react";
import {
  Link2,
  Bookmark,
  CalendarClock,
  Shuffle,
  LayoutGrid,
  ArrowRight,
  X,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DashboardTourProps {
  open: boolean;
  onDismiss: () => void;
  onFinish: () => void;
}

const STEPS = [
  {
    id: "welcome",
    icon: Sparkles,
    iconColor: "text-wm-gold",
    iconBg: "bg-wm-gold/10",
    tag: null,
    title: "Welcome to Watchlist Wonders",
    body: "Your personal library for everything worth watching — films, series, YouTube videos, docs, and social clips. All in one place.",
    illustration: <WelcomeIllustration />,
  },
  {
    id: "add",
    icon: Link2,
    iconColor: "text-primary",
    iconBg: "bg-primary/10",
    tag: "Step 1",
    title: "Paste any link, save any video",
    body: "Copy a URL from YouTube, Instagram, X, or Netflix. Paste it in the bar at the top of your dashboard — we'll automatically pull the title, poster, and runtime.",
    illustration: <AddIllustration />,
  },
  {
    id: "library",
    icon: LayoutGrid,
    iconColor: "text-emerald-400",
    iconBg: "bg-emerald-400/10",
    tag: "Step 2",
    title: "Your library, organized for you",
    body: "Saves appear in rows — Continue Watching, Saved for Later, and grouped by mood. Filter by type (movie, series, doc) or status in one tap.",
    illustration: <LibraryIllustration />,
  },
  {
    id: "schedule",
    icon: CalendarClock,
    iconColor: "text-sky-400",
    iconBg: "bg-sky-400/10",
    tag: "Step 3",
    title: "Schedule it. Never forget it.",
    body: "Pick any saved title, set a date and time, and it'll appear in your Up Next rail. Your calendar stays in sync — no more lost recommendations.",
    illustration: <ScheduleIllustration />,
  },
  {
    id: "surprise",
    icon: Shuffle,
    iconColor: "text-violet-400",
    iconBg: "bg-violet-400/10",
    tag: "Step 4",
    title: "Can't decide? Let us pick.",
    body: "Hit Surprise Me in the toolbar and we'll randomly surface something from your backlog. One tap to watch, mark done, or reroll.",
    illustration: <SurpriseIllustration />,
  },
] as const;

export function DashboardTour({ open, onDismiss, onFinish }: DashboardTourProps) {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<"forward" | "back">("forward");

  if (!open) return null;

  const current = STEPS[step];
  const isFirst = step === 0;
  const isLast = step === STEPS.length - 1;

  const goNext = () => {
    if (isLast) {
      onFinish();
      return;
    }
    setDirection("forward");
    setStep((s) => s + 1);
  };

  const goBack = () => {
    setDirection("back");
    setStep((s) => s - 1);
  };

  const Icon = current.icon;

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onDismiss(); }}
    >
      {/* Card */}
      <div
        className="relative w-full max-w-md bg-wm-surface border border-border rounded-2xl shadow-2xl overflow-hidden"
        style={{ maxHeight: "90dvh" }}
      >
        {/* Dismiss button */}
        <button
          onClick={onDismiss}
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-border transition-colors"
          aria-label="Skip tour"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Illustration area */}
        <div className="relative h-48 bg-gradient-to-b from-wm-surface to-background overflow-hidden flex items-center justify-center">
          {current.illustration}
        </div>

        {/* Content */}
        <div className="px-6 pb-6 pt-2">
          {/* Tag + icon */}
          <div className="flex items-center gap-2 mb-3">
            <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", current.iconBg)}>
              <Icon className={cn("w-4 h-4", current.iconColor)} />
            </div>
            {current.tag && (
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {current.tag}
              </span>
            )}
          </div>

          {/* Title */}
          <h2 className="text-xl font-bold text-foreground mb-2 leading-tight">
            {current.title}
          </h2>

          {/* Body */}
          <p className="text-sm text-muted-foreground leading-relaxed mb-6">
            {current.body}
          </p>

          {/* Step dots + controls */}
          <div className="flex items-center justify-between">
            {/* Dot indicators */}
            <div className="flex items-center gap-1.5">
              {STEPS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => { setDirection(i > step ? "forward" : "back"); setStep(i); }}
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-300",
                    i === step
                      ? "w-6 bg-primary"
                      : "w-1.5 bg-border hover:bg-muted-foreground"
                  )}
                  aria-label={`Go to step ${i + 1}`}
                />
              ))}
            </div>

            {/* Buttons */}
            <div className="flex items-center gap-2">
              {!isFirst && (
                <Button variant="ghost" size="sm" onClick={goBack} className="h-9 px-3 text-sm">
                  Back
                </Button>
              )}
              <Button
                size="sm"
                onClick={goNext}
                className={cn(
                  "h-9 px-4 text-sm gap-1.5",
                  isLast && "bg-primary hover:bg-primary/90"
                )}
              >
                {isLast ? (
                  <>
                    Start exploring
                    <Bookmark className="w-3.5 h-3.5" />
                  </>
                ) : (
                  <>
                    Next
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Illustrations ─────────────────────────────────────────── */

function WelcomeIllustration() {
  return (
    <div className="relative flex items-center justify-center w-full h-full select-none">
      {/* Background glow */}
      <div className="absolute inset-0 bg-gradient-to-b from-wm-gold/5 to-transparent" />

      {/* Floating poster cards */}
      <div className="relative flex items-end gap-3 pb-4">
        {[
          { bg: "bg-sky-900", rotate: "-rotate-6", scale: "scale-95", z: "z-0", mt: "mt-6" },
          { bg: "bg-violet-900", rotate: "rotate-0", scale: "scale-100", z: "z-10", mt: "mt-0" },
          { bg: "bg-emerald-900", rotate: "rotate-6", scale: "scale-95", z: "z-0", mt: "mt-6" },
        ].map(({ bg, rotate, scale, z, mt }, i) => (
          <div
            key={i}
            className={cn(
              "w-20 h-28 rounded-xl border border-white/10 shadow-xl flex items-end p-2",
              bg, rotate, scale, z, mt
            )}
          >
            <div className="w-full h-1.5 bg-white/20 rounded-full" />
          </div>
        ))}
      </div>

      {/* Gold sparkle badge */}
      <div className="absolute top-4 right-1/2 translate-x-12 bg-wm-gold/20 border border-wm-gold/30 rounded-full px-3 py-1 flex items-center gap-1.5">
        <Sparkles className="w-3 h-3 text-wm-gold" />
        <span className="text-[11px] font-semibold text-wm-gold">Watchlist Wonders</span>
      </div>
    </div>
  );
}

function AddIllustration() {
  return (
    <div className="relative flex flex-col items-center justify-center w-full h-full gap-3 px-6 select-none">
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent" />

      {/* Simulated URL sources */}
      <div className="flex gap-2 mb-1">
        {["YT", "IG", "X", "🎬"].map((label, i) => (
          <div
            key={i}
            className={cn(
              "w-9 h-9 rounded-xl border border-border flex items-center justify-center text-xs font-bold",
              i === 0 ? "bg-red-500/20 text-red-400 border-red-500/30" :
              i === 1 ? "bg-pink-500/20 text-pink-400 border-pink-500/30" :
              i === 2 ? "bg-sky-500/20 text-sky-400 border-sky-500/30" :
              "bg-wm-surface text-muted-foreground"
            )}
          >
            {label}
          </div>
        ))}
      </div>

      {/* Arrow down */}
      <div className="flex flex-col items-center gap-0.5">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="w-0.5 h-1.5 bg-primary/40 rounded-full"
            style={{ opacity: 1 - i * 0.25 }}
          />
        ))}
      </div>

      {/* Simulated QuickAddBar */}
      <div className="w-full max-w-xs bg-wm-surface border border-primary/40 rounded-xl px-4 py-2.5 flex items-center gap-2 shadow-lg ring-1 ring-primary/20">
        <Link2 className="w-4 h-4 text-primary shrink-0" />
        <span className="text-xs text-muted-foreground flex-1 truncate">Paste a link…</span>
        <div className="w-16 h-6 bg-primary rounded-lg" />
      </div>

      {/* Result card */}
      <div className="w-full max-w-xs bg-wm-surface border border-border rounded-xl px-3 py-2 flex items-center gap-3">
        <div className="w-8 h-11 rounded bg-violet-900/60 shrink-0" />
        <div className="flex-1 space-y-1.5">
          <div className="h-2 bg-foreground/20 rounded w-3/4" />
          <div className="h-1.5 bg-muted-foreground/20 rounded w-1/2" />
        </div>
        <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
          <Bookmark className="w-3 h-3 text-emerald-400" />
        </div>
      </div>
    </div>
  );
}

function LibraryIllustration() {
  return (
    <div className="relative flex flex-col justify-center w-full h-full px-4 gap-3 select-none">
      <div className="absolute inset-0 bg-gradient-to-b from-emerald-400/5 to-transparent" />

      {/* Rail rows */}
      {[
        { label: "Continue Watching", color: "bg-sky-900/60" },
        { label: "Saved for Later", color: "bg-violet-900/60" },
        { label: "Chill Picks", color: "bg-emerald-900/60" },
      ].map(({ label, color }, ri) => (
        <div key={ri} className="space-y-1.5">
          <div className="h-2 bg-foreground/15 rounded w-28 ml-1" />
          <div className="flex gap-2 overflow-hidden">
            {[...Array(4)].map((_, ci) => (
              <div
                key={ci}
                className={cn("shrink-0 w-14 h-20 rounded-lg", color)}
                style={{ opacity: ci === 3 ? 0.3 : 1 }}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Filter chips overlay hint */}
      <div className="absolute bottom-3 right-3 flex gap-1">
        {["All", "Movies", "Series"].map((chip, i) => (
          <div
            key={chip}
            className={cn(
              "px-2 py-0.5 rounded-full text-[9px] font-semibold border",
              i === 0
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-wm-surface text-muted-foreground border-border"
            )}
          >
            {chip}
          </div>
        ))}
      </div>
    </div>
  );
}

function ScheduleIllustration() {
  return (
    <div className="relative flex flex-col items-center justify-center w-full h-full gap-3 px-6 select-none">
      <div className="absolute inset-0 bg-gradient-to-b from-sky-400/5 to-transparent" />

      {/* Calendar card */}
      <div className="w-full max-w-xs bg-wm-surface border border-border rounded-2xl overflow-hidden shadow-lg">
        {/* Header */}
        <div className="bg-sky-900/40 px-4 py-2.5 flex items-center justify-between">
          <span className="text-[11px] font-semibold text-sky-300">March 2026</span>
          <CalendarClock className="w-3.5 h-3.5 text-sky-400" />
        </div>
        {/* Day grid */}
        <div className="grid grid-cols-7 gap-0 px-2 py-2">
          {["M","T","W","T","F","S","S"].map((d, i) => (
            <div key={i} className="flex items-center justify-center h-5 text-[9px] text-muted-foreground font-medium">
              {d}
            </div>
          ))}
          {[...Array(21)].map((_, i) => (
            <div
              key={i}
              className={cn(
                "flex items-center justify-center h-6 text-[10px] rounded-full mx-auto w-6",
                i + 1 === 8
                  ? "bg-primary text-primary-foreground font-bold"
                  : i + 1 === 14
                  ? "bg-sky-500/20 text-sky-400 font-semibold"
                  : "text-muted-foreground"
              )}
            >
              {i + 1}
            </div>
          ))}
        </div>
        {/* Scheduled item */}
        <div className="mx-3 mb-3 px-3 py-2 bg-sky-500/10 border border-sky-500/20 rounded-xl flex items-center gap-2">
          <div className="w-7 h-9 rounded bg-sky-900/60 shrink-0" />
          <div className="flex-1 space-y-1">
            <div className="h-1.5 bg-foreground/20 rounded w-full" />
            <div className="text-[9px] text-sky-400 font-medium">Today · 8:00 PM</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SurpriseIllustration() {
  return (
    <div className="relative flex flex-col items-center justify-center w-full h-full gap-4 select-none">
      <div className="absolute inset-0 bg-gradient-to-b from-violet-400/5 to-transparent" />

      {/* Shuffle orbit */}
      <div className="relative w-28 h-28">
        {/* Center button */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-16 h-16 rounded-2xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center shadow-lg">
            <Shuffle className="w-7 h-7 text-violet-400" />
          </div>
        </div>
        {/* Orbiting mini-posters */}
        {[
          { top: "-8px", left: "50%", rotate: "0deg", offset: "-50%" },
          { top: "50%", right: "-8px", rotate: "90deg", offset: "-50%" },
          { bottom: "-8px", left: "50%", rotate: "180deg", offset: "-50%" },
          { top: "50%", left: "-8px", rotate: "270deg", offset: "-50%" },
        ].map((pos, i) => (
          <div
            key={i}
            className={cn(
              "absolute w-8 h-10 rounded-lg border border-white/10",
              ["bg-sky-900", "bg-rose-900", "bg-amber-900", "bg-emerald-900"][i]
            )}
            style={{
              top: pos.top,
              bottom: (pos as any).bottom,
              left: pos.left,
              right: (pos as any).right,
              transform: `translate(${(pos as any).offset ?? "0"}, -50%)`,
            }}
          />
        ))}
      </div>

      {/* Action pills */}
      <div className="flex gap-2">
        {["Watch Now", "Mark Done", "Reroll"].map((label, i) => (
          <div
            key={label}
            className={cn(
              "px-2.5 py-1 rounded-lg text-[10px] font-semibold border",
              i === 0
                ? "bg-primary/20 text-primary border-primary/30"
                : "bg-wm-surface text-muted-foreground border-border"
            )}
          >
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}
