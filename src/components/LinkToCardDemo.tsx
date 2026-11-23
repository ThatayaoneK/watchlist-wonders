import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Loader2, Play } from "lucide-react";
import { cn } from "@/lib/utils";

const DEMO_URL = "tiktok.com/@user/funny-movie-clip";
const DEMO_MOVIE = { title: "The Dark Knight", year: "2008", runtime: "2h 32m", tag: "Movie" };
const TYPE_SPEED = 38; // ms per character

type DemoPhase = "idle" | "typing" | "loading" | "found" | "pause";

export function LinkToCardDemo({ active = true }: { active?: boolean }) {
  const [phase, setPhase] = useState<DemoPhase>("idle");
  const [typed, setTyped] = useState("");
  const [charIdx, setCharIdx] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = () => { if (timerRef.current) clearTimeout(timerRef.current); };

  useEffect(() => {
    if (!active) {
      clear();
      setPhase("idle");
      setTyped("");
      setCharIdx(0);
      return;
    }

    clear();
    if (phase === "idle") {
      timerRef.current = setTimeout(() => { setPhase("typing"); setCharIdx(0); setTyped(""); }, 900);
    } else if (phase === "typing") {
      if (charIdx < DEMO_URL.length) {
        timerRef.current = setTimeout(() => {
          setTyped(DEMO_URL.slice(0, charIdx + 1));
          setCharIdx((c) => c + 1);
        }, TYPE_SPEED);
      } else {
        timerRef.current = setTimeout(() => setPhase("loading"), 400);
      }
    } else if (phase === "loading") {
      timerRef.current = setTimeout(() => setPhase("found"), 1400);
    } else if (phase === "found") {
      timerRef.current = setTimeout(() => { setPhase("idle"); setTyped(""); }, 3200);
    }
    return clear;
  }, [phase, charIdx, active]);

  return (
    <div className="w-full max-w-xs mx-auto space-y-3 select-none">
      {/* URL input */}
      <div className={cn(
        "flex items-center gap-2 bg-[#1c1c1c] border rounded-xl px-4 py-3 transition-all duration-300",
        phase === "loading" ? "border-[#e50914]/60 shadow-[0_0_16px_rgba(229,9,20,0.18)]" : "border-white/15"
      )}>
        <div className="w-3 h-3 rounded-full bg-[#e50914]/70 shrink-0" />
        <span className="text-sm text-white/90 flex-1 font-mono truncate min-w-0">
          {typed || (
            <span className="text-white/35">Paste a link from anywhere...</span>
          )}
          {(phase === "typing") && (
            <span className="inline-block w-0.5 h-3.5 bg-[#e50914] ml-0.5 animate-pulse align-middle" />
          )}
        </span>
        {phase === "loading" && (
          <Loader2 className="w-4 h-4 text-[#e50914] animate-spin shrink-0" />
        )}
        {(phase === "found") && (
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
        )}
      </div>

      {/* Detecting label */}
      <div className={cn(
        "text-xs text-center transition-all duration-300",
        phase === "loading" ? "text-[#e50914]/80 opacity-100" : "opacity-0 pointer-events-none"
      )}>
        Finding movie details...
      </div>

      {/* Movie card result */}
      <div className={cn(
        "bg-[#1c1c1c] border border-white/10 rounded-xl overflow-hidden transition-all duration-500",
        phase === "found" ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3 pointer-events-none"
      )}>
        <div className="flex items-stretch gap-0">
          {/* Poster */}
          <div className="w-16 shrink-0 bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center">
            <Play className="w-5 h-5 text-white/30 fill-white/20" />
          </div>
          {/* Info */}
          <div className="flex-1 p-3 space-y-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{DEMO_MOVIE.title}</p>
            <p className="text-xs text-white/55">{DEMO_MOVIE.year} · {DEMO_MOVIE.runtime}</p>
            <div className="flex items-center gap-1.5 pt-0.5">
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#e50914]/20 text-[#ff9aa0] border border-[#e50914]/20 font-medium">
                {DEMO_MOVIE.tag}
              </span>
              <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-0.5">
                <Check className="w-2.5 h-2.5" /> Saved
              </span>
            </div>
          </div>
        </div>
        {/* "Watch tonight" bar */}
        <div className="px-3 pb-2.5 pt-0">
          <div className="bg-[#e50914]/10 border border-[#e50914]/20 rounded-lg px-3 py-1.5 flex items-center justify-between">
            <span className="text-[10px] text-[#ff9aa0] font-medium">Suggested for tonight</span>
            <ArrowRight className="w-3 h-3 text-[#e50914]" />
          </div>
        </div>
      </div>
    </div>
  );
}
