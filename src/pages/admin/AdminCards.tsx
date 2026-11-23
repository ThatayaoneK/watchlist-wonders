import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function AdminPageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="mb-6">
      <h2 className="text-lg font-semibold text-zinc-100">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>}
    </header>
  );
}

export function MetricCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: 'default' | 'success' | 'warning' | 'danger';
}) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border bg-zinc-950 p-5',
        tone === 'success' && 'border-emerald-500/20',
        tone === 'warning' && 'border-amber-500/20',
        tone === 'danger' && 'border-red-500/20',
        (!tone || tone === 'default') && 'border-zinc-800',
      )}
    >
      {tone && tone !== 'default' && (
        <div
          className={cn(
            'absolute inset-x-0 top-0 h-0.5',
            tone === 'success' && 'bg-emerald-500',
            tone === 'warning' && 'bg-amber-500',
            tone === 'danger' && 'bg-red-500',
          )}
        />
      )}
      <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-500">{label}</p>
      <p
        className={cn(
          'mt-2.5 text-3xl font-bold tracking-tight',
          tone === 'success' && 'text-emerald-400',
          tone === 'warning' && 'text-amber-400',
          tone === 'danger' && 'text-red-400',
          (!tone || tone === 'default') && 'text-zinc-100',
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-1.5 text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}

export function Panel({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-950 p-5">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-300">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

export function AdminErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => Promise<unknown> | unknown;
}) {
  return (
    <div className="rounded-xl border border-red-500/20 bg-red-500/[0.04] p-6 text-sm">
      <p className="font-semibold text-red-300">Admin data unavailable</p>
      <p className="mt-2 text-red-400/80">{message}</p>
      <Button
        type="button"
        variant="outline"
        className="mt-4 border-red-500/20 bg-transparent text-red-300 hover:bg-red-500/10 hover:text-red-200"
        onClick={() => {
          void onRetry();
        }}
      >
        Refresh admin access and retry
      </Button>
    </div>
  );
}

export function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return `${(value * 100).toFixed(1)}%`;
}

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return value.toLocaleString();
}
