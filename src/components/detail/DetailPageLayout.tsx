import { Bookmark, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";

type SpecItem = {
  label: string;
  value: string;
};

type DetailPageLayoutProps = {
  image: string;
  brand?: string;
  title: string;
  subtitle?: string;
  year?: number | string;
  runtime?: string;
  description: string;
  specs?: SpecItem[];
  editorialTitle?: string;
  editorialBody?: string;
  primaryCtaLabel?: string;
  onPrimaryCtaClick?: () => void;
  onSave?: () => void;
  onShare?: () => void;
  children?: React.ReactNode;
  className?: string;
};

export function DetailPageLayout({
  image,
  brand,
  title,
  subtitle,
  year,
  runtime,
  description,
  specs = [],
  editorialTitle,
  editorialBody,
  primaryCtaLabel = "View Collection",
  onPrimaryCtaClick,
  onSave,
  onShare,
  children,
  className,
}: DetailPageLayoutProps) {
  return (
    <main className={cn("bg-[#09090B] text-white", className)}>
      {/* ── HERO ─────────────────────────────────────────── */}
      <section className="relative min-h-[100svh] overflow-hidden">
        {/* Background image with zoom-in animation on mount */}
        <img
          src={image}
          alt={title}
          className="absolute inset-0 h-full w-full object-cover animate-[hero-zoom_1.4s_var(--wm-ease-snappy)_forwards]"
        />

        {/* Base scrim */}
        <div className="absolute inset-0 bg-black/50" />

        {/* Gradient: bottom fade to page bg */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#09090B] via-black/15 to-black/55" />

        {/* Gold ambient */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_40%,rgba(200,169,107,0.14),transparent_38%)]" />

        {/* Content — anchored to bottom */}
        <div className="relative z-10 flex min-h-[100svh] items-end px-5 pb-16 md:px-12 lg:px-20">
          <div className="w-full max-w-[720px] animate-in fade-in slide-in-from-bottom-4 duration-700">
            {brand && (
              <p className="mb-3 text-[11px] uppercase tracking-[0.26em] text-[#C8A96B]">
                {brand}
              </p>
            )}

            <h1 className="text-[48px] font-semibold leading-[0.94] tracking-tight md:text-[76px]">
              {title}
            </h1>

            {/* Meta line */}
            <div className="mt-5 flex flex-wrap items-center gap-3 text-[13px] text-zinc-400">
              {subtitle && <span>{subtitle}</span>}
              {year && (
                <>
                  {subtitle && <span aria-hidden="true">·</span>}
                  <span>{year}</span>
                </>
              )}
              {runtime && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{runtime}</span>
                </>
              )}
            </div>

            <p className="mt-7 max-w-[580px] text-[16px] leading-[1.85] text-zinc-300">
              {description}
            </p>

            {/* Actions */}
            <div className="mt-9 flex flex-wrap items-center gap-3">
              {onPrimaryCtaClick && (
                <button
                  type="button"
                  onClick={onPrimaryCtaClick}
                  className="rounded-full bg-[#C8A96B] px-7 py-3.5 text-[13px] font-semibold text-black transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                >
                  {primaryCtaLabel}
                </button>
              )}

              {onSave && (
                <button
                  type="button"
                  onClick={onSave}
                  className="flex items-center gap-2.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-5 py-3.5 text-[13px] text-white backdrop-blur-xl transition-all duration-200 hover:bg-white/[0.08]"
                >
                  <Bookmark size={15} />
                  Save
                </button>
              )}

              {onShare && (
                <button
                  type="button"
                  onClick={onShare}
                  className="flex items-center gap-2.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-5 py-3.5 text-[13px] text-white backdrop-blur-xl transition-all duration-200 hover:bg-white/[0.08]"
                >
                  <Share2 size={15} />
                  Share
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── SPECS ────────────────────────────────────────── */}
      {specs.length > 0 && (
        <section className="border-t border-white/[0.05] px-5 py-16 md:px-12 lg:px-20">
          <div className="grid gap-10 sm:grid-cols-2 md:grid-cols-4">
            {specs.map(({ label, value }, index) => (
              <div key={`${index}-${label}`}>
                <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-600">{label}</p>
                <p className="mt-2.5 text-[22px] font-medium text-white">{value}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── EDITORIAL NARRATIVE ──────────────────────────── */}
      {(editorialTitle || editorialBody) && (
        <section className="border-t border-white/[0.05] px-5 py-20 md:px-12 lg:px-20">
          <div className="max-w-[820px]">
            {editorialTitle && (
              <h2 className="text-[28px] font-semibold leading-tight tracking-tight text-white md:text-[38px]">
                {editorialTitle}
              </h2>
            )}
            {editorialBody && (
              <p className="mt-6 text-[16px] leading-[1.9] text-zinc-400">{editorialBody}</p>
            )}
          </div>
        </section>
      )}

      {/* ── SLOT FOR ADDITIONAL CONTENT (related items etc.) */}
      {children && (
        <section className="border-t border-white/[0.05] px-5 py-16 md:px-12 lg:px-20">
          {children}
        </section>
      )}
    </main>
  );
}
