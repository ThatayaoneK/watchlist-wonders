import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LinkToCardDemo } from "@/components/LinkToCardDemo";
import { DemoSheet } from "@/components/DemoSheet";
import { usePwaInstallPrompt } from "@/hooks/usePwaInstallPrompt";

/* ─── FAQ ────────────────────────────────────────────────────── */

const FAQ_ITEMS = [
  {
    q: "What exactly is WatchMarks?",
    a: "It's your personal list for movies and shows. You save them, and WatchMarks helps you decide what to watch — instead of scrolling forever trying to remember what you saved.",
  },
  {
    q: "How do I add something to my list?",
    a: "Copy the link from wherever you found it — a TikTok, YouTube video, Netflix title, IMDb page — and paste it in. We find the movie or show automatically. No manual typing.",
  },
  {
    q: "What does 'we tell you what to watch next' mean?",
    a: "WatchMarks looks at what you've saved, how long it is, and your mood — then surfaces the best pick for right now. Short on time? It shows you something under 30 minutes. Want something intense? It filters for that.",
  },
  {
    q: "Is it free?",
    a: "Yes, completely free to start. Save as many links as you want.",
  },
  {
    q: "Does it work on my phone?",
    a: "Yes. Your list syncs across phone, tablet, and desktop. Save on your phone while scrolling TikTok, watch later on your TV.",
  },
  {
    q: "How do reminders work?",
    a: "Once something is in your list, you can schedule it for a specific night. WatchMarks will remind you when it's time — so you don't forget you saved it.",
  },
];

/* ─── Main page ──────────────────────────────────────────────── */

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState(-1);
  const [demoOpen, setDemoOpen] = useState(false);
  const { canInstall, promptInstall } = usePwaInstallPrompt();

  useEffect(() => {
    if (!loading && user) navigate("/library");
  }, [loading, navigate, user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#141414] text-white flex items-center justify-center">
        <Loader2 className="w-5 h-5 text-white/40 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#141414] text-white">

      {/* ── Nav ─────────────────────────────────────────────── */}
      <header className="fixed top-0 inset-x-0 z-50 bg-black/70 backdrop-blur-md border-b border-white/10">
        <div className="mx-auto max-w-7xl h-[68px] px-4 sm:px-6 lg:px-10 flex items-center justify-between">
          <span className="text-[#e50914] text-2xl font-black tracking-tight">WATCHMARKS</span>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => navigate("/auth")} className="text-white/80 hover:text-white hover:bg-white/10">
              Sign in
            </Button>
            <Button onClick={() => navigate("/auth")} className="bg-[#e50914] hover:bg-[#f6121d] text-white font-semibold">
              Start free
            </Button>
          </div>
        </div>
      </header>

      <main className="pt-[68px]">

        {/* ── HERO ──────────────────────────────────────────── */}
        <section className="relative border-b-8 border-[#1e1e1e] overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_0%,rgba(229,9,20,0.18),transparent_50%)]" />
          <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-10 py-16 sm:py-24">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">

              {/* Left: words */}
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-white/50 font-semibold mb-5">
                  Never lose a recommendation again
                </p>
                <h1 className="text-4xl sm:text-5xl lg:text-[3.25rem] font-black leading-[1.06] mb-6">
                  Save it when you see it.{" "}
                  <span className="text-[#e50914]">Find it instantly when you're ready.</span>
                </h1>
                <p className="text-lg text-white/75 leading-relaxed mb-3 max-w-lg">
                  See something on TikTok, YouTube, or Instagram? Paste the link — WatchMarks finds the movie and saves it in seconds. No forms, no typing.
                </p>
                <p className="text-lg text-white/75 leading-relaxed mb-10 max-w-lg">
                  When you want to watch, your whole list is searchable instantly — or we pick the best thing for right now.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    size="lg"
                    onClick={() => navigate("/auth")}
                    className="h-12 px-8 text-base font-semibold bg-[#e50914] hover:bg-[#f6121d]"
                  >
                    Start free — no card needed
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() => setDemoOpen(true)}
                    className="h-12 px-8 text-base font-semibold border-white/20 text-white/75 hover:text-white hover:border-white/40 hover:bg-white/5 bg-transparent"
                  >
                    See it in action
                  </Button>
                  {canInstall && (
                    <Button
                      size="lg"
                      variant="outline"
                      onClick={() => {
                        void promptInstall();
                      }}
                      className="h-12 px-8 text-base font-semibold border-white/20 text-white/75 hover:text-white hover:border-white/40 hover:bg-white/5 bg-transparent"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Install app
                    </Button>
                  )}
                </div>
                <div className="mt-4 space-y-1">
                  <p className="text-sm text-white/40">Takes 30 seconds to set up.</p>
                  <p className="text-sm text-white/45 max-w-lg">
                    Mobile share-sheet support is still rolling out. If Watchmarks is missing from the share sheet,
                    copy the link first, then open Watchmarks to paste it.
                  </p>
                </div>
              </div>

              {/* Right: live demo */}
              <div className="relative">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(229,9,20,0.1),transparent_70%)]" />
                <div className="relative bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 shadow-2xl">
                  <p className="text-xs text-white/40 uppercase tracking-wider font-medium mb-4 text-center">
                    See how it works
                  </p>
                  <LinkToCardDemo />
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ──────────────────────────────────── */}
        <section className="border-b-8 border-[#1e1e1e] py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
            <h2 className="text-3xl sm:text-4xl font-bold text-center mb-3">
              Three steps. That's it.
            </h2>
            <p className="text-white/60 text-center mb-14 max-w-md mx-auto">
              No setup. No configuration. Just paste a link and go.
            </p>
            <div className="grid sm:grid-cols-3 gap-6 lg:gap-10">
              {[
                {
                  step: "1",
                  headline: "You see something",
                  detail: "A TikTok clip, YouTube video, or someone's IMDb recommendation. Anything.",
                  icon: "👀",
                  color: "border-white/10",
                },
                {
                  step: "2",
                  headline: "Paste the link",
                  detail: "We find the movie or show automatically — title, poster, runtime. You don't type anything.",
                  icon: "📋",
                  color: "border-[#e50914]/30",
                },
                {
                  step: "3",
                  headline: "Find it or let us pick",
                  detail: "Search your list instantly, or let WatchMarks surface the best pick based on your mood and time available. No more scrolling from scratch.",
                  icon: "🎬",
                  color: "border-white/10",
                },
              ].map((item, i) => (
                <div key={i} className="relative">
                  {/* Arrow between steps */}
                  {i < 2 && (
                    <div className="hidden sm:flex absolute -right-5 top-8 z-10 items-center">
                      <ChevronRight className="w-5 h-5 text-white/20" />
                    </div>
                  )}
                  <div className={cn(
                    "h-full bg-[#1c1c1c] border rounded-2xl p-6",
                    item.color
                  )}>
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-2xl">{item.icon}</span>
                      <span className="text-xs font-bold text-white/30 uppercase tracking-widest">
                        Step {item.step}
                      </span>
                    </div>
                    <h3 className="text-xl font-bold mb-2">{item.headline}</h3>
                    <p className="text-white/65 leading-relaxed">{item.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── WHY USE IT ────────────────────────────────────── */}
        <section className="border-b-8 border-[#1e1e1e] py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-3xl sm:text-4xl font-bold mb-6">
                  Stop losing things you want to watch.
                </h2>
                <p className="text-white/65 text-lg leading-relaxed mb-8">
                  You see it on TikTok, save it somewhere, and never find it again. Or you sit down to watch, can't remember what you saved, and scroll Netflix for 20 minutes. WatchMarks solves both.
                </p>
                <ul className="space-y-4">
                  {[
                    "Everything you want to watch lives in one place — not scattered across TikTok saves, Instagram bookmarks, and screenshots you'll never find again.",
                    "Search your saved list instantly, or let us pick the best thing based on how much time you have.",
                    "Your list actually gets used instead of growing forever and being ignored.",
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="w-5 h-5 rounded-full bg-[#e50914]/20 border border-[#e50914]/30 flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="w-2.5 h-2.5 text-[#e50914]" />
                      </span>
                      <span className="text-white/75">{item}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  size="lg"
                  onClick={() => navigate("/auth")}
                  className="mt-10 h-12 px-8 bg-[#e50914] hover:bg-[#f6121d] font-semibold"
                >
                  Try it free
                </Button>
              </div>

              {/* Visual: outcome grid */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "No more decision paralysis", sub: "We pick. You watch.", color: "from-[#e50914]/15", icon: "🎯" },
                  { label: "Works wherever you find things", sub: "TikTok, YouTube, IMDb, anywhere", color: "from-sky-500/15", icon: "🌐" },
                  { label: "Short on time?", sub: "Filter to under 30 min instantly", color: "from-emerald-500/15", icon: "⚡" },
                  { label: "Saved for tonight", sub: "Reminders so you don't forget", color: "from-amber-500/15", icon: "🔔" },
                ].map((card, i) => (
                  <div
                    key={i}
                    className={cn(
                      "bg-gradient-to-br to-[#1c1c1c] border border-white/8 rounded-2xl p-5",
                      card.color
                    )}
                  >
                    <div className="text-2xl mb-3">{card.icon}</div>
                    <p className="text-sm font-semibold text-white mb-1">{card.label}</p>
                    <p className="text-xs text-white/50">{card.sub}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── FAQ ───────────────────────────────────────────── */}
        <section className="border-b-8 border-[#1e1e1e] py-16 sm:py-20">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-10">
            <h2 className="text-3xl sm:text-4xl font-bold text-center mb-10">Questions</h2>
            <div className="space-y-2">
              {FAQ_ITEMS.map((item, index) => {
                const isOpen = openFaq === index;
                return (
                  <div key={item.q} className="bg-[#1e1e1e] rounded-xl overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setOpenFaq(isOpen ? -1 : index)}
                      className="w-full text-left px-5 py-4 flex items-center justify-between hover:bg-[#252525] transition-colors"
                      aria-expanded={isOpen}
                    >
                      <span className="text-base font-medium pr-4">{item.q}</span>
                      <ChevronDown className={cn("w-4 h-4 text-white/40 shrink-0 transition-transform", isOpen && "rotate-180")} />
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-5 text-white/70 leading-relaxed">
                        {item.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── FINAL CTA ─────────────────────────────────────── */}
        <section className="py-20 sm:py-28 text-center">
          <div className="mx-auto max-w-2xl px-4 sm:px-6">
            <h2 className="text-3xl sm:text-5xl font-black leading-tight mb-5">
              Start with one link.
            </h2>
            <p className="text-white/65 text-lg mb-10">
              Paste the next thing you want to watch. We'll handle the rest.
            </p>
            <Button
              size="lg"
              onClick={() => navigate("/auth")}
              className="h-14 px-10 text-lg font-bold bg-[#e50914] hover:bg-[#f6121d]"
            >
              Get started — it's free
            </Button>
            <p className="mt-5 text-sm text-white/35">No card. No download. Works on any device.</p>
            <div className="mt-4 text-xs text-white/45 space-y-1">
              <p>Privacy-first by default. Export your data any time from Settings.</p>
              <p>
                <Link to="/terms" className="underline underline-offset-2 hover:text-white">
                  Terms
                </Link>{" "}
                ·{" "}
                <Link to="/privacy" className="underline underline-offset-2 hover:text-white">
                  Privacy
                </Link>
              </p>
            </div>
          </div>
        </section>

      </main>

      <DemoSheet open={demoOpen} onClose={() => setDemoOpen(false)} />
    </div>
  );
};

export default Index;
