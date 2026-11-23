import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { adminService } from '@/services/admin';
import { AdminErrorState, AdminPageHeader, MetricCard, Panel, formatNumber, formatPercent } from './AdminCards';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useAdminPageQuery } from './useAdminPageQuery';

export default function Retention() {
  const { data, isLoading, error, errorMessage, retryAdminQuery } = useAdminPageQuery({
    queryKey: ['admin', 'retention'],
    queryFn: () => adminService.getRetention(),
    refetchInterval: 5 * 60_000,
    fallbackMessage: 'Failed to load retention metrics.',
  });

  if (isLoading) return <div className="flex justify-center py-16"><LoadingSpinner /></div>;
  if (error || !data) {
    return <AdminErrorState message={errorMessage ?? 'Failed to load retention metrics.'} onRetry={retryAdminQuery} />;
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Retention"
        subtitle="Resurfacing engine effectiveness — what gets re-opened vs ignored."
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard label="Surfaced" value={formatNumber(data.surfaced)} />
        <MetricCard
          label="Opened"
          value={formatNumber(data.opened)}
          hint={formatPercent(data.openRate)}
          tone={data.openRate > 0.2 ? 'success' : 'default'}
        />
        <MetricCard
          label="Dismissed"
          value={formatNumber(data.dismissed)}
          hint={formatPercent(data.dismissRate)}
          tone={data.dismissRate > 0.5 ? 'warning' : 'default'}
        />
        <MetricCard
          label="Open rate"
          value={formatPercent(data.openRate)}
          hint="how often resurface lands"
        />
      </div>

      <Panel title="Resurface activity (14 days)">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.byDay}>
              <XAxis dataKey="date" tick={{ fill: '#71717a', fontSize: 11 }} />
              <YAxis tick={{ fill: '#71717a', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#0e0e10', border: '1px solid rgba(255,255,255,0.08)', fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="surfaced" stroke="#60a5fa" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="opened" stroke="#34d399" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="dismissed" stroke="#f87171" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Panel>
    </div>
  );
}
