import { Sparkles } from 'lucide-react';
import { adminService } from '@/services/admin';
import { AdminErrorState, AdminPageHeader, MetricCard, Panel, formatNumber } from './AdminCards';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useAdminPageQuery } from './useAdminPageQuery';

export default function ContentGraph() {
  const { data, isLoading, error, errorMessage, retryAdminQuery } = useAdminPageQuery({
    queryKey: ['admin', 'contentGraph'],
    queryFn: () => adminService.getContentGraph(),
    refetchInterval: 10 * 60_000,
    fallbackMessage: 'Failed to load content graph.',
  });

  if (isLoading) return <div className="flex justify-center py-16"><LoadingSpinner /></div>;
  if (error || !data) {
    return <AdminErrorState message={errorMessage ?? 'Failed to load content graph.'} onRetry={retryAdminQuery} />;
  }

  const maxSize = data.topClusters.reduce((m, c) => Math.max(m, c.size), 0);
  const emerging = data.topClusters.filter((c) => c.emerging).length;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Content Graph"
        subtitle="Top clusters across the system — where attention is consolidating."
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard label="Total clusters" value={formatNumber(data.totalClusters)} />
        <MetricCard label="Top 50 displayed" value={formatNumber(data.topClusters.length)} />
        <MetricCard
          label="Emerging trends"
          value={formatNumber(emerging)}
          hint="clusters seeded recently"
          tone={emerging > 0 ? 'success' : 'default'}
        />
      </div>

      <Panel title="Top clusters by member count">
        {data.topClusters.length === 0 ? (
          <p className="text-sm text-muted-foreground">No clusters formed yet.</p>
        ) : (
          <div className="space-y-2">
            {data.topClusters.map((cluster) => {
              const pct = maxSize === 0 ? 0 : cluster.size / maxSize;
              return (
                <div key={`${cluster.userId}:${cluster.id}`} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      {cluster.emerging && <Sparkles className="h-3.5 w-3.5 text-emerald-400" />}
                      <span className="font-medium">{cluster.name}</span>
                      <span className="text-xs text-zinc-500">· u/{cluster.userId.slice(0, 8)}</span>
                    </span>
                    <span className="tabular-nums text-zinc-400">{formatNumber(cluster.size)}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.05]">
                    <div
                      className="h-full rounded-full bg-blue-400/80 transition-all"
                      style={{ width: `${Math.round(pct * 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}
