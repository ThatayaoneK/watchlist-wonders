import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, Play, Sparkles } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { LinkToCardDemo } from "@/components/LinkToCardDemo";
import { cn } from "@/lib/utils";

/* ─── Demo data ──────────────────────────────────────────────── */

type DemoItem = {
  id: string;
  title: string;
  year: number;
  runtime: number;
  type: "Movie" | "Series" | "Doc";
  mood: string[];
  status?: "watching" | "up_next";
  progress?: number;
};

const DEMO_ITEMS: DemoItem[] = [
  { id: "d1", title: "Inception",           year: 2010, runtime: 148, type: "Movie",  mood: ["mind-bending", "thriller"], status: "up_next" },
  { id: "d2", title: "The Bear",            year: 2022, runtime: 45,  type: "Series", mood: ["intense", "drama"],         status: "watching", progress: 35 },
  { id: "d3", title: "Chef's Table: Pizza", year: 2020, runtime: 32,  type: "Doc",    mood: ["relaxing"] },
  { id: "d4", title: "Oppenheimer",         year: 2023, runtime: 181, type: "Movie",  mood: ["epic", "thoughtful"] },
  { id: "d5", title: "Dune: Part Two",      year: 2024, runtime: 166, type: "Movie",  mood: ["epic"] },
  { id: "d6", title: "Blade Runner 2049",   year: 2017, runtime: 164, type: "Movie",  mood: ["thoughtful", "sci-fi"] },
];

const FILTER_RULES: Record<string, (item: DemoItem) => boolean> = {
  "⚡ Quick":     (i) => i.runtime <= 60,
  "🔥 Intense":  (i) => i.mood.some((m) => ["thriller", "intense", "epic", "drama"].includes(m)),
  "🤔 Thoughtful": (i) => i.mood.some((m) => ["thoughtful", "mind-bending", "sci-fi"].includes(m)),
};

const MOOD_PICKS: Record<string, string> = {
  "⚡ Quick":     "d3",
  "🔥 Intense":  "d1",
  "🤔 Thoughtful": "d6",
};

const MOOD_REASONS: Record<string, string> = {
  d1: "2h 28m · Mind-bending thriller · Saved from TikTok",
  d3: "32m · Relaxing documentary · Quick watch",
  d6: "2h 44m · Thoughtful sci-fi · Long evening pick",
};

function fmtRuntime(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ""}` : `${m}m`;
}

/* ─── DemoMiniCard ───────────────────────────────────────────── */

function DemoMiniCard({
  item,
  highlighted,
  dimmed,
  featured,
}: {
  item: DemoItem;
  highlighted?: boolean;
  dimmed?: boolean;
  featured?: boolean;
}) {
  return (
    <div className={cn(
      "flex items-center gap-3 bg-[#1c1c1c] rounded-xl border transition-all duration-200",
      featured ? "p-4 flex-col items-start" : "p-3",
      highlighted ? "border-[#e50914]/50 shadow-[0_0_10px_rgba(229,9,20,0.1)]" : "border-white/8",
      dimmed && "opacity-35",
    )}>
      {/* Poster placeholder */}
      <div className={cn(
        "shrink-0 bg-gradient-to-br from-slate-700 to-slate-900 rounded-lg flex items-center justify-center",
        featured ? "w-full h-28" : "w-12 h-16"
      )}>
        <Play className={cn("text-white/25 fill-white/15", featured ? "w-8 h-8" : "w-4 h-4")} />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <p className={cn("font-semibold text-white truncate", featured ? "text-lg" : "text-sm")}>
            {item.title}
          </p>
          {item.status === "up_next" && (
            <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-[#e50914]/20 text-[#ff9aa0] border border-[#e50914]/20 font-medium">
              Up next
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-white/45">{item.year}</span>
          <span className="text-white/20 text-xs">·</span>
          <span className="flex items-center gap-0.5 text-xs text-white/45">
            <Clock className="w-3 h-3" /> {fmtRuntime(item.runtime)}
          </span>
          <span className="text-white/20 text-xs">·</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/50 border border-white/8">
            {item.type}
          </span>
        </div>

        {item.status === "watching" && item.progress !== undefined && (
          <div className="mt-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-white/40">Watching · {item.progress}%</span>
            </div>
            <div className="h-1 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#e50914] rounded-full"
                style={{ width: `${item.progress}%` }}
              />
            </div>
          </div>
        )}

        {featured && MOOD_REASONS[item.id] && (
          <p className="mt-2 text-xs text-white/50 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-[#e50914]/70 shrink-0" />
            {MOOD_REASONS[item.id]}
          </p>
        )}
      </div>
    </div>
  );
}

/* ─── DemoSheet ──────────────────────────────────────────────── */

interface DemoSheetProps {
  open: boolean;
  onClose: () => void;
}

export function DemoSheet({ open, onClose }: DemoSheetProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("capture");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [activeMood, setActiveMood] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setActiveTab("capture");
      setActiveFilter(null);
      setActiveMood(null);
    }
  }, [open]);

  const handleConvert = () => {
    onClose();
    navigate("/auth");
  };

  const featuredId = activeMood ? MOOD_PICKS[activeMood] : "d1";
  const featuredItem = DEMO_ITEMS.find((i) => i.id === featuredId)!;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="bottom"
        className="h-[92vh] bg-[#141414] border-white/10 text-white flex flex-col p-0 rounded-t-2xl"
      >
        {/* Header */}
        <div className="px-5 pt-6 pb-3 shrink-0">
          <SheetTitle className="text-white text-lg font-bold">Try WatchMarks</SheetTitle>
          <p className="text-sm text-white/50 mt-0.5">See what your list looks like — no account needed</p>
        </div>

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex flex-col flex-1 overflow-hidden px-5"
        >
          <TabsList className="bg-[#1c1c1c] border border-white/10 w-full grid grid-cols-3 shrink-0 mb-4 h-10">
            <TabsTrigger
              value="capture"
              className="text-white/50 data-[state=active]:bg-[#e50914]/20 data-[state=active]:text-white data-[state=active]:shadow-none text-sm"
            >
              📋 Save
            </TabsTrigger>
            <TabsTrigger
              value="recall"
              className="text-white/50 data-[state=active]:bg-[#e50914]/20 data-[state=active]:text-white data-[state=active]:shadow-none text-sm"
            >
              🔍 Browse
            </TabsTrigger>
            <TabsTrigger
              value="act"
              className="text-white/50 data-[state=active]:bg-[#e50914]/20 data-[state=active]:text-white data-[state=active]:shadow-none text-sm"
            >
              🎬 Tonight
            </TabsTrigger>
          </TabsList>

          {/* ── Capture tab ── */}
          <TabsContent value="capture" className="flex-1 overflow-y-auto space-y-5 pb-4 mt-0">
            <div>
              <p className="text-sm text-white/60 mb-4">
                Paste any link from TikTok, YouTube, or IMDb — we find the movie automatically.
              </p>
              <LinkToCardDemo active={activeTab === "capture"} />
            </div>

            <div>
              <p className="text-xs uppercase tracking-widest text-white/30 font-semibold mb-3">
                Also in your list
              </p>
              <div className="space-y-2">
                {DEMO_ITEMS.filter((i) => ["d4", "d2"].includes(i.id)).map((item) => (
                  <DemoMiniCard key={item.id} item={item} />
                ))}
              </div>
            </div>
          </TabsContent>

          {/* ── Recall tab ── */}
          <TabsContent value="recall" className="flex-1 overflow-y-auto pb-4 mt-0">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-white/60">Filter your saved list instantly</p>
              <span className="text-xs text-white/35 bg-white/5 border border-white/10 rounded-full px-2 py-0.5">
                {DEMO_ITEMS.length} saved
              </span>
            </div>

            {/* Filter chips */}
            <div className="flex gap-2 mb-4 flex-wrap">
              {Object.keys(FILTER_RULES).map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setActiveFilter(activeFilter === label ? null : label)}
                  className={cn(
                    "text-sm px-3 py-1.5 rounded-full border transition-all duration-150 font-medium",
                    activeFilter === label
                      ? "bg-[#e50914]/20 border-[#e50914]/50 text-white"
                      : "bg-white/5 border-white/15 text-white/60 hover:text-white hover:border-white/30"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* List */}
            <div className="space-y-2">
              {DEMO_ITEMS.map((item) => {
                const matches = activeFilter ? FILTER_RULES[activeFilter](item) : true;
                return (
                  <DemoMiniCard
                    key={item.id}
                    item={item}
                    highlighted={!!activeFilter && matches}
                    dimmed={!!activeFilter && !matches}
                  />
                );
              })}
            </div>
          </TabsContent>

          {/* ── Act tab ── */}
          <TabsContent value="act" className="flex-1 overflow-y-auto pb-4 mt-0">
            <p className="text-sm text-white/60 mb-3">What are you feeling tonight?</p>

            {/* Mood chips */}
            <div className="flex gap-2 mb-5 flex-wrap">
              {Object.keys(MOOD_PICKS).map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setActiveMood(activeMood === label ? null : label)}
                  className={cn(
                    "text-sm px-3 py-1.5 rounded-full border transition-all duration-150 font-medium",
                    activeMood === label
                      ? "bg-[#e50914]/20 border-[#e50914]/50 text-white"
                      : "bg-white/5 border-white/15 text-white/60 hover:text-white hover:border-white/30"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Featured pick */}
            <div className="mb-4">
              <p className="text-xs uppercase tracking-widest text-white/30 font-semibold mb-3">
                {activeMood ? "Best match for you" : "Top pick from your list"}
              </p>
              <DemoMiniCard item={featuredItem} featured />
            </div>

            {/* Disabled watch button */}
            <div className="relative group">
              <Button
                disabled
                className="w-full h-11 bg-[#e50914]/30 text-white/40 cursor-not-allowed font-semibold"
              >
                <Play className="w-4 h-4 mr-2 fill-current" /> Watch now
              </Button>
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap bg-black/80 text-white/80 text-xs px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-white/10">
                Sign up to watch
              </div>
            </div>

            <p className="text-xs text-white/35 text-center mt-3">
              One tap to your streaming provider — no dead ends.
            </p>
          </TabsContent>
        </Tabs>

        {/* Sticky CTA footer */}
        <div className="shrink-0 px-5 pb-6 pt-3 border-t border-white/10 bg-[#141414]">
          <Button
            onClick={handleConvert}
            className="w-full h-12 bg-[#e50914] hover:bg-[#f6121d] font-bold text-base"
          >
            Create free account
          </Button>
          <p className="text-xs text-white/35 text-center mt-2">
            No card. No download. Takes 30 seconds.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
