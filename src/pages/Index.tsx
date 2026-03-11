import { useEffect, useState, type ComponentType } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Play, Bookmark, Bell, Link2, ArrowRight, Star,
  Clock, Calendar, Check,
} from "lucide-react";

// Platform showcase data
const PLATFORMS = [
  { name: "YouTube",    color: "bg-red-600",    icon: "▶", domain: "youtube.com" },
  { name: "Instagram",  color: "bg-pink-500",   icon: "📷", domain: "instagram.com" },
  { name: "Facebook",   color: "bg-blue-600",   icon: "f", domain: "facebook.com" },
  { name: "X / Twitter",color: "bg-neutral-800",icon: "𝕏", domain: "x.com" },
  { name: "Netflix",    color: "bg-red-700",    icon: "N", domain: "netflix.com" },
  { name: "IMDB",       color: "bg-yellow-500", icon: "i", domain: "imdb.com" },
];

type DemoStep = "idle" | "typing" | "loading" | "enriched";

function delay(ms: number) {
  return new Promise<void>((res) => setTimeout(res, ms));
}

const DEMO_URL = "youtube.com/watch?v=dQw4w9WgXcQ";

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [demoStep, setDemoStep] = useState<DemoStep>("idle");
  const [demoUrl, setDemoUrl] = useState("");

  useEffect(() => {
    if (!loading && user) navigate("/dashboard");
  }, [user, loading, navigate]);

  // Animated demo loop
  useEffect(() => {
    let cancelled = false;

    const runSequence = async () => {
      if (cancelled) return;

      await delay(1800);
      if (cancelled) return;

      // Type URL
      setDemoStep("typing");
      for (let i = 1; i <= DEMO_URL.length; i++) {
        if (cancelled) return;
        setDemoUrl(DEMO_URL.slice(0, i));
        await delay(42);
      }

      await delay(500);
      if (cancelled) return;

      // Fetching
      setDemoStep("loading");
      await delay(2000);
      if (cancelled) return;

      // Result
      setDemoStep("enriched");
      await delay(4500);
      if (cancelled) return;

      // Reset
      setDemoStep("idle");
      setDemoUrl("");

      runSequence();
    };

    runSequence();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ─── Navbar ─────────────────────────────────────── */}
      <header className="fixed top-0 inset-x-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="container mx-auto px-4 lg:px-8 flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-primary rounded">
              <Play className="w-4 h-4 text-primary-foreground fill-current" />
            </div>
            <span className="text-xl font-bold">WatchMarks</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/auth")}>Sign In</Button>
            <Button size="sm" onClick={() => navigate("/auth")}>Get Started Free</Button>
          </div>
        </div>
      </header>

      {/* ─── Hero ────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center pt-16 overflow-hidden">
        {/* Ambient glows */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-background to-background pointer-events-none" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/6 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/3 right-1/4 w-72 h-72 bg-wm-gold/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 container mx-auto px-4 lg:px-8 py-24">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left — copy */}
            <div className="animate-fade-in">
              <p className="text-xs font-bold tracking-widest text-wm-gold uppercase mb-6">
                SAVE ANYTHING · WATCH EVERYTHING
              </p>

              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold leading-tight mb-6">
                Bookmark it now.
                <br />
                <span className="text-primary">Watch it later.</span>
              </h1>

              <p className="text-lg md:text-xl text-muted-foreground max-w-lg mb-8 leading-relaxed">
                Bookmark movies and shows from Instagram, YouTube, Facebook, and X.
                Schedule reminders. Never lose track of what you wanted to watch.
              </p>

              {/* Platform icons row */}
              <div className="flex items-center gap-3 mb-10">
                <span className="text-sm text-muted-foreground shrink-0">Works with:</span>
                <div className="flex items-center gap-2">
                  {PLATFORMS.map((p) => (
                    <div
                      key={p.name}
                      title={p.name}
                      className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0",
                        p.color
                      )}
                    >
                      {p.icon}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <Button size="lg" onClick={() => navigate("/auth")} className="text-base px-8 py-6">
                  Get Started — it's free
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
                <Button variant="outline" size="lg" onClick={() => navigate("/auth")} className="text-base px-8 py-6">
                  Sign In
                </Button>
              </div>
            </div>

            {/* Right — animated demo */}
            <div className="relative hidden lg:flex justify-center">
              <div className="relative w-full max-w-sm bg-card rounded-2xl border border-border p-6 shadow-2xl">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-3">
                  See it in action
                </p>

                {/* URL bar */}
                <div className="flex gap-2 mb-5">
                  <div className="flex-1 relative">
                    <div className="bg-background border border-border rounded-lg px-3 py-2.5 text-xs font-mono min-h-[38px] flex items-center">
                      {demoStep === "idle" ? (
                        <span className="text-muted-foreground">Paste a link…</span>
                      ) : (
                        <span className="text-foreground break-all">
                          {demoUrl}
                          {demoStep === "typing" && (
                            <span className="inline-block w-0.5 h-3 bg-primary ml-0.5 animate-pulse align-middle" />
                          )}
                        </span>
                      )}
                    </div>
                    {(demoStep === "loading" || demoStep === "enriched") && (
                      <span className="absolute -top-2.5 left-2 text-[10px] bg-red-600 text-white px-1.5 py-0.5 rounded font-medium">
                        ▶ YouTube
                      </span>
                    )}
                  </div>
                  <Button size="sm" className="shrink-0 h-[38px] text-xs" disabled={demoStep === "idle" || demoStep === "typing"}>
                    {demoStep === "loading" ? (
                      <span className="w-3 h-3 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    ) : "Save"}
                  </Button>
                </div>

                {/* Loading skeleton */}
                {demoStep === "loading" && (
                  <div className="space-y-2 animate-fade-in">
                    <div className="flex gap-3">
                      <div className="w-14 h-20 bg-muted rounded animate-pulse shrink-0" />
                      <div className="flex-1 space-y-2 pt-1">
                        <div className="h-3 bg-muted rounded animate-pulse w-3/4" />
                        <div className="h-3 bg-muted rounded animate-pulse w-1/2" />
                        <div className="h-3 bg-muted rounded animate-pulse w-2/3" />
                      </div>
                    </div>
                  </div>
                )}

                {/* Enriched result card */}
                {demoStep === "enriched" && (
                  <div className="flex gap-3 animate-fade-in">
                    <div className="w-14 h-20 bg-gradient-to-br from-red-900 to-red-600 rounded-lg shrink-0 flex items-center justify-center">
                      <Play className="w-6 h-6 text-white fill-current" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[10px] bg-red-600 text-white px-1 py-0.5 rounded font-bold">YT</span>
                        <span className="text-[10px] text-muted-foreground">Music Video</span>
                      </div>
                      <p className="text-sm font-semibold text-foreground mb-0.5 truncate">Never Gonna Give You Up</p>
                      <p className="text-[11px] text-muted-foreground mb-2">Rick Astley · 1987 · 3m</p>
                      <div className="flex gap-1 mb-3 flex-wrap">
                        <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">fun</span>
                        <span className="text-[10px] bg-wm-gold/20 text-wm-gold px-1.5 py-0.5 rounded-full">nostalgic</span>
                      </div>
                      <div className="flex gap-1.5">
                        <div className="flex items-center gap-1 text-[10px] text-chart-3 bg-chart-3/10 px-1.5 py-0.5 rounded-full">
                          <Check className="w-2.5 h-2.5" />
                          Bookmarked!
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                          <Bell className="w-2.5 h-2.5" />
                          Remind me
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {demoStep === "idle" && (
                  <div className="flex gap-3 opacity-30">
                    <div className="w-14 h-20 bg-muted rounded-lg shrink-0" />
                    <div className="flex-1 space-y-2 pt-1">
                      <div className="h-3 bg-muted rounded w-3/4" />
                      <div className="h-3 bg-muted rounded w-1/2" />
                    </div>
                  </div>
                )}
              </div>

              {/* Floating badges */}
              <div className="absolute -top-4 -right-4 bg-card border border-border rounded-lg px-3 py-2 shadow-lg">
                <div className="flex items-center gap-2">
                  <Star className="w-3.5 h-3.5 text-wm-gold fill-current" />
                  <span className="text-xs font-medium">47 bookmarked this week</span>
                </div>
              </div>
              <div className="absolute -bottom-4 -left-4 bg-card border border-border rounded-lg px-3 py-2 shadow-lg">
                <div className="flex items-center gap-2">
                  <Bell className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-medium">Reminder: Tonight 8pm</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── How It Works ────────────────────────────────── */}
      <section className="py-24 bg-wm-surface/40">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Three steps to a better watchlist</h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              No more forgotten tabs or screenshots. Paste, bookmark, and watch.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <StepCard
              step={1}
              icon={Link2}
              title="Paste any link"
              description="Copy a link from Instagram, YouTube, Facebook, or X. We'll automatically fetch the title, poster, and runtime."
              accentClass="text-primary bg-primary/10"
            />
            <StepCard
              step={2}
              icon={Bookmark}
              title="Bookmark it instantly"
              description="Your bookmarks in one place. Filter by mood, status, or platform. Add notes and tags anytime."
              accentClass="text-wm-gold bg-wm-gold/10"
            />
            <StepCard
              step={3}
              icon={Bell}
              title="Get reminded"
              description="Schedule for tonight, the weekend, or any custom time. Push notifications on mobile."
              accentClass="text-chart-3 bg-chart-3/10"
            />
          </div>
        </div>
      </section>

      {/* ─── Platform Showcase ───────────────────────────── */}
      <section className="py-24">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Works with every platform you use</h2>
            <p className="text-muted-foreground">Paste links from anywhere — we'll pull all the details automatically.</p>
          </div>

          <div className="grid grid-cols-3 md:grid-cols-6 gap-4 max-w-3xl mx-auto">
            {PLATFORMS.map((p) => (
              <div
                key={p.name}
                className="flex flex-col items-center gap-3 p-4 rounded-xl bg-card border border-border hover:border-primary/40 transition-all group cursor-default"
              >
                <div className={cn("w-12 h-12 rounded-full flex items-center justify-center text-white text-xl font-bold transition-transform group-hover:scale-110", p.color)}>
                  {p.icon}
                </div>
                <div className="text-center">
                  <p className="text-xs font-medium leading-tight">{p.name}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{p.domain}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Feature Highlights ──────────────────────────── */}
      <section className="py-24 bg-wm-surface/40">
        <div className="container mx-auto px-4 lg:px-8 max-w-5xl space-y-24">
          <FeatureRow
            icon={Bookmark}
            tag="INSTANT BOOKMARK"
            title="Smart auto-enrichment"
            description="Paste any link and we instantly fetch the title, poster art, runtime, and release year. Add mood tags and notes — then it's bookmarked to your personal watchlist."
            mockup={<EnrichMockup />}
            reversed={false}
          />
          <FeatureRow
            icon={Star}
            tag="SMART PICKS"
            title="Tonight's Pick"
            description="Can't decide? Hit Tonight's Pick and we'll surface three titles from your backlog that fit your evening — under 90 minutes, randomly chosen, perfect for now."
            mockup={<TonightMockup />}
            reversed={true}
          />
          <FeatureRow
            icon={Bell}
            tag="SMART REMINDERS"
            title="Reminders that work"
            description="Schedule for tonight, this weekend, or a custom time. Choose how far in advance to be reminded. Push notifications delivered right to your phone."
            mockup={<ReminderMockup />}
            reversed={false}
          />
        </div>
      </section>

      {/* ─── CTA Banner ──────────────────────────────────── */}
      <section className="py-24">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="bg-gradient-to-r from-primary/15 via-primary/8 to-wm-gold/8 rounded-3xl border border-primary/20 p-12 text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Your bookmark for everything worth watching.
            </h2>
            <p className="text-muted-foreground max-w-md mx-auto mb-8">
              Join WatchMarks for free. No credit card required.
            </p>
            <Button size="lg" onClick={() => navigate("/auth")} className="text-base px-10 py-6">
              Start for free
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </div>
      </section>

      {/* ─── Footer ──────────────────────────────────────── */}
      <footer className="py-10 border-t border-border">
        <div className="container mx-auto px-4 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-primary rounded">
              <Play className="w-4 h-4 text-primary-foreground fill-current" />
            </div>
            <span className="text-lg font-semibold">WatchMarks</span>
          </div>
          <p className="text-sm text-muted-foreground text-center">
            © {new Date().getFullYear()} WatchMarks. Save anything. Watch everything.
          </p>
        </div>
      </footer>
    </div>
  );
};

/* ─── Sub-components ─────────────────────────────────── */

interface StepCardProps {
  step: number;
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  accentClass: string;
}

function StepCard({ step, icon: Icon, title, description, accentClass }: StepCardProps) {
  return (
    <div className="relative p-6 rounded-2xl bg-card border border-border hover:border-primary/30 transition-all">
      <span className="absolute -top-3 left-5 text-[10px] font-bold bg-background border border-border px-2 py-0.5 rounded text-muted-foreground uppercase tracking-wider">
        Step {step}
      </span>
      <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center mb-4 mt-2", accentClass)}>
        <Icon className="w-5 h-5" />
      </div>
      <h3 className="text-base font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}

interface FeatureRowProps {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  tag: string;
  reversed: boolean;
  mockup: React.ReactNode;
}

function FeatureRow({ title, description, tag, reversed, mockup }: FeatureRowProps) {
  return (
    <div className={cn("flex flex-col md:flex-row items-center gap-12", reversed && "md:flex-row-reverse")}>
      <div className="flex-1">
        <p className="text-xs font-bold tracking-widest text-wm-gold uppercase mb-4">{tag}</p>
        <h3 className="text-2xl md:text-3xl font-bold mb-4">{title}</h3>
        <p className="text-muted-foreground text-lg leading-relaxed">{description}</p>
      </div>
      <div className="flex-1 flex justify-center">
        {mockup}
      </div>
    </div>
  );
}

// Mockup for enrichment feature
function EnrichMockup() {
  return (
    <div className="w-full max-w-xs bg-card rounded-2xl border border-border p-4 space-y-3">
      <div className="flex gap-3">
        <div className="w-16 h-22 bg-gradient-to-b from-blue-900 to-blue-700 rounded-lg shrink-0 flex items-center justify-center aspect-[2/3]">
          <Play className="w-6 h-6 text-white fill-current" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="text-[10px] bg-pink-500 text-white px-1.5 py-0.5 rounded font-bold">IG</span>
            <span className="text-[10px] text-muted-foreground">Movie</span>
          </div>
          <p className="text-sm font-semibold mb-0.5">Dune: Part Two</p>
          <p className="text-[11px] text-muted-foreground mb-2">2024 · 2h 46m</p>
          <div className="flex gap-1 flex-wrap">
            <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">epic</span>
            <span className="text-[10px] bg-chart-4/20 text-chart-4 px-1.5 py-0.5 rounded-full">scifi</span>
          </div>
        </div>
      </div>
      <div className="h-px bg-border" />
      <div className="flex items-center gap-1.5 text-xs text-chart-3">
        <Check className="w-3.5 h-3.5" />
        Details auto-fetched from TMDB
      </div>
    </div>
  );
}

// Mockup for Tonight's Pick
function TonightMockup() {
  const picks = [
    { title: "Parasite", runtime: "2h 12m", mood: "intense" },
    { title: "The Grand Budapest Hotel", runtime: "1h 39m", mood: "quirky" },
    { title: "Everything Everywhere", runtime: "2h 19m", mood: "emotional" },
  ];
  return (
    <div className="w-full max-w-xs space-y-2">
      {picks.map((p, i) => (
        <div key={i} className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3">
          <div className="w-8 h-8 bg-wm-surface-hover rounded-lg flex items-center justify-center shrink-0">
            <Star className="w-4 h-4 text-wm-gold fill-current" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{p.title}</p>
            <p className="text-[11px] text-muted-foreground">{p.runtime}</p>
          </div>
          <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full shrink-0">{p.mood}</span>
        </div>
      ))}
    </div>
  );
}

// Mockup for Reminders
function ReminderMockup() {
  return (
    <div className="w-full max-w-xs bg-card rounded-2xl border border-border p-5 space-y-4">
      <p className="text-sm font-semibold">When do you want to watch?</p>
      <div className="grid grid-cols-2 gap-2">
        {["Tonight", "Tomorrow", "This Weekend", "Next Week"].map((opt, i) => (
          <div
            key={opt}
            className={cn(
              "text-center py-2.5 rounded-lg text-xs font-medium border transition-colors",
              i === 0
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-wm-surface border-border text-muted-foreground"
            )}
          >
            {opt}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-wm-surface rounded-lg px-3 py-2.5">
        <Clock className="w-3.5 h-3.5 text-primary shrink-0" />
        Remind me 1 hour before
      </div>
      <div className="flex items-center gap-2 text-xs text-chart-3 bg-chart-3/10 rounded-lg px-3 py-2.5">
        <Bell className="w-3.5 h-3.5 shrink-0" />
        Push notification: Tonight at 7:00 PM
      </div>
    </div>
  );
}

export default Index;
