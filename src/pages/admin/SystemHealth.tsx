import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { adminService } from '@/services/admin';
import { AdminErrorState, AdminPageHeader, MetricCard, Panel, formatNumber, formatPercent } from './AdminCards';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useAdminPageQuery } from './useAdminPageQuery';

export default function SystemHealth() {
  const { data, isLoading, error, errorMessage, retryAdminQuery } = useAdminPageQuery({
    queryKey: ['admin', 'systemHealth'],
    queryFn: () => adminService.getSystemHealth(),
    refetchInterval: 60_000,
    fallbackMessage: 'Failed to load system health.',
  });

  if (isLoading) return <div className="flex justify-center py-16"><LoadingSpinner /></div>;
  if (error || !data) {
    return <AdminErrorState message={errorMessage ?? 'Failed to load system health.'} onRetry={retryAdminQuery} />;
  }

  const todayIngest = data.ingestion[data.ingestion.length - 1];

  return (
    <div className="space-y-6">
      <AdminPageHeader title="System Health" subtitle="Ingestion pipeline status and embedding queue depth." />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard
          label="Today's saves"
          value={formatNumber(todayIngest?.success ?? 0)}
          hint={`${todayIngest?.partial ?? 0} partial, ${todayIngest?.error ?? 0} errored`}
        />
        <MetricCard
          label="14-day failure rate"
          value={formatPercent(data.failureRate)}
          tone={data.failureRate > 0.1 ? 'warning' : 'success'}
        />
        <MetricCard
          label="Embedding queue"
          value={formatNumber(data.embedQueue)}
          hint="bookmarks awaiting cluster assignment"
          tone={data.embedQueue > 500 ? 'warning' : 'default'}
        />
        <MetricCard
          label="Top error stage"
          value={data.recentErrors[0]?.stage ?? '—'}
          hint={data.recentErrors[0] ? `${formatNumber(data.recentErrors[0].count)} in 14d` : 'no errors'}
        />
      </div>

      <Panel title="Ingestion rate (last 14 days)">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.ingestion}>
              <XAxis dataKey="date" tick={{ fill: '#71717a', fontSize: 11 }} />
              <YAxis tick={{ fill: '#71717a', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#0e0e10', border: '1px solid rgba(255,255,255,0.08)', fontSize: 12 }} />
              <Line type="monotone" dataKey="success" stroke="#34d399" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="partial" stroke="#fbbf24" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="error" stroke="#f87171" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel title="Errors by stage (14 days)">
        <div className="space-y-2">
          {data.recentErrors.length === 0 && (
            <p className="text-sm text-muted-foreground">No errors recorded.</p>
          )}
          {data.recentErrors.map((row) => (
            <div key={row.stage} className="flex items-center justify-between rounded-lg bg-white/[0.02] px-3 py-2">
              <span className="text-sm">{row.stage}</span>
              <span className="text-sm tabular-nums text-amber-400">{formatNumber(row.count)}</span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
