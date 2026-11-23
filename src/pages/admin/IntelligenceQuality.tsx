import { adminService } from '@/services/admin';
import { AdminErrorState, AdminPageHeader, MetricCard, Panel, formatPercent } from './AdminCards';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useAdminPageQuery } from './useAdminPageQuery';

export default function IntelligenceQuality() {
  const { data, isLoading, error, errorMessage, retryAdminQuery } = useAdminPageQuery({
    queryKey: ['admin', 'intelligenceQuality'],
    queryFn: () => adminService.getIntelligenceQuality(),
    refetchInterval: 5 * 60_000,
    fallbackMessage: 'Failed to load intelligence metrics.',
  });

  if (isLoading) return <div className="flex justify-center py-16"><LoadingSpinner /></div>;
  if (error || !data) {
    return <AdminErrorState message={errorMessage ?? 'Failed to load intelligence metrics.'} onRetry={retryAdminQuery} />;
  }

  const classifierTotal = Object.values(data.classifierDistribution).reduce((a, b) => a + b, 0);
  const resolveTotal = Object.values(data.resolveDistribution).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Intelligence Quality"
        subtitle="Confidence in classification, entity resolution, and auto-tagging."
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          label="Suggested-vs-matched ratio"
          value={formatPercent(data.suggestedRatio)}
          hint="lower is better (high-confidence matches)"
          tone={data.suggestedRatio > 0.4 ? 'warning' : 'success'}
        />
        <MetricCard
          label="Auto-tag success rate"
          value={formatPercent(data.autoTagsPerBookmark)}
          hint="bookmarks with tags / total processed"
        />
        <MetricCard
          label="Resolve sources"
          value={Object.keys(data.resolveDistribution).length || '—'}
          hint="distinct external sources matched"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Panel title="Classifier output (14 days)">
          <DistributionBars dist={data.classifierDistribution} total={classifierTotal} accent="#60a5fa" />
        </Panel>
        <Panel title="Entity resolution sources (14 days)">
          <DistributionBars dist={data.resolveDistribution} total={resolveTotal} accent="#34d399" />
        </Panel>
      </div>
    </div>
  );
}

function DistributionBars({
  dist,
  total,
  accent,
}: {
  dist: Record<string, number>;
  total: number;
  accent: string;
}) {
  const rows = Object.entries(dist).sort((a, b) => b[1] - a[1]);
  if (!rows.length) {
    return <p className="text-sm text-muted-foreground">No data yet.</p>;
  }
  return (
    <div className="space-y-2">
      {rows.map(([key, count]) => {
        const pct = total === 0 ? 0 : count / total;
        return (
          <div key={key} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="capitalize text-zinc-300">{key}</span>
              <span className="tabular-nums text-zinc-500">
                {count.toLocaleString()} · {(pct * 100).toFixed(1)}%
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.05]">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${Math.round(pct * 100)}%`, background: accent }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
