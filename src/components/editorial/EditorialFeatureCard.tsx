import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

type EditorialFeatureCardProps = {
  image: string;
  eyebrow?: string;
  title: string;
  description: string;
  metadata?: string;
  cta?: string;
  reverse?: boolean;
  onClick?: () => void;
};

export function EditorialFeatureCard({
  image,
  eyebrow,
  title,
  description,
  metadata,
  cta,
  reverse = false,
  onClick,
}: EditorialFeatureCardProps) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  const FALLBACK_IMAGE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='600'%3E%3Crect fill='%23222' width='800' height='600'/%3E%3C/svg%3E";

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (img.src !== FALLBACK_IMAGE) {
      img.src = FALLBACK_IMAGE;
    }
  };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "-80px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={ref} className="px-4 py-10 md:px-8 lg:px-14">
      <article
        className={cn(
          "group relative overflow-hidden rounded-[32px] border border-white/[0.06] bg-[#111114]",
          "transition-all duration-700 ease-out",
          visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8",
        )}
      >
        <div
          className={cn(
            "grid min-h-[560px] grid-cols-1 lg:grid-cols-12",
            reverse && "lg:[direction:rtl]",
          )}
        >
          {/* Image side — 7 columns */}
          <div className="relative lg:col-span-7">
            <div className="absolute inset-0">
              <img
                src={image}
                alt={title}
                onError={handleImageError}
                className="h-full w-full object-cover transition-transform duration-[800ms] ease-out group-hover:scale-[1.03]"
              />
            </div>

            {/* Edge gradient toward content side */}
            <div
              className={cn(
                "absolute inset-0",
                reverse
                  ? "bg-gradient-to-l from-black/10 via-transparent to-black/55"
                  : "bg-gradient-to-r from-black/10 via-transparent to-black/55",
              )}
            />

            {/* Gold ambient glow */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_50%,rgba(200,169,107,0.14),transparent_45%)]" />

            {/* Mobile bottom fade */}
            <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#111114] to-transparent lg:hidden" />
          </div>

          {/* Content side — 5 columns */}
          <div className={cn("relative flex items-center lg:col-span-5", reverse && "[direction:ltr]")}>
            <div className="relative z-10 w-full p-7 md:p-10 lg:p-14">
              {eyebrow && (
                <p className="mb-4 text-[11px] uppercase tracking-[0.24em] text-[#C8A96B]">
                  {eyebrow}
                </p>
              )}

              <h2 className="max-w-[480px] text-[34px] font-semibold leading-[0.97] tracking-tight text-white md:text-[48px]">
                {title}
              </h2>

              <p className="mt-5 max-w-[480px] text-[15px] leading-[1.8] text-zinc-400">
                {description}
              </p>

              {metadata && (
                <div className="mt-7 text-[12px] uppercase tracking-[0.18em] text-zinc-600">
                  {metadata}
                </div>
              )}

              {cta && onClick && (
                <button
                  type="button"
                  onClick={onClick}
                  className="group/btn mt-8 inline-flex items-center gap-3 rounded-full border border-white/[0.08] bg-white/[0.03] px-6 py-3.5 text-[13px] font-medium text-white backdrop-blur-xl transition-all duration-300 hover:bg-white/[0.06]"
                >
                  {cta}
                  <ArrowRight
                    size={15}
                    className="transition-transform duration-300 group-hover/btn:translate-x-1"
                  />
                </button>
              )}
            </div>
          </div>
        </div>
      </article>
    </section>
  );
}
