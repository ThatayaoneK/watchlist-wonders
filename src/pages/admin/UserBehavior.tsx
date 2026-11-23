import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { adminService } from '@/services/admin';
import { AdminErrorState, AdminPageHeader, MetricCard, Panel, formatNumber, formatPercent } from './AdminCards';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useAdminPageQuery } from './useAdminPageQuery';

export default function UserBehavior() {
  const { data, isLoading, error, errorMessage, retryAdminQuery } = useAdminPageQuery({
    queryKey: ['admin', 'userBehavior'],
    queryFn: () => adminService.getUserBehavior(),
    refetchInterval: 5 * 60_000,
    fallbackMessage: 'Failed to load user behavior.',
  });

  if (isLoading) return <div className="flex justify-center py-16"><LoadingSpinner /></div>;
  if (error || !data) {
    return <AdminErrorState message={errorMessage ?? 'Failed to load user behavior.'} onRetry={retryAdminQuery} />;
  }

  const totalRecentSaves = data.savesByDay.reduce((s, d) => s + d.saves, 0);
  const avgPerUser = data.totalUsers === 0 ? 0 : totalRecentSaves / data.totalUsers;
  const totalCaptures = data.captureByDay.reduce((s, d) => s + d.total, 0);
  const autoSaved = data.captureByStatus.auto_saved ?? 0;
  const captureAutoRate = totalCaptures === 0 ? 0 : autoSaved / totalCaptures;
  const topSurface = Object.entries(data.captureBySurface).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="space-y-6">
      <AdminPageHeader title="User Behavior" subtitle="Engagement, save velocity, and retrieval signal." />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard label="Total users" value={formatNumber(data.totalUsers)} />
        <MetricCard label="Total bookmarks" value={formatNumber(data.totalBookmarks)} />
        <MetricCard
          label="Avg saves / user (14d)"
          value={avgPerUser.toFixed(1)}
          hint={`${formatNumber(totalRecentSaves)} saves in window`}
        />
        <MetricCard
          label="Dead bookmark ratio"
          value={formatPercent(data.deadBookmarkRatio)}
          hint="no canonical entity resolved"
          tone={data.deadBookmarkRatio > 0.4 ? 'warning' : 'default'}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          label="Capture requests (14d)"
          value={formatNumber(totalCaptures)}
          hint={topSurface ? `top source: ${topSurface[0]}` : "waiting for native/web capture traffic"}
        />
        <MetricCard
          label="Auto-save rate"
          value={formatPercent(captureAutoRate)}
          hint={`${formatNumber(autoSaved)} auto-matched captures`}
        />
        <MetricCard
          label="Needs selection"
          value={formatNumber(data.captureByStatus.needs_selection ?? 0)}
          hint="captures that needed user disambiguation"
          tone={(data.captureByStatus.needs_selection ?? 0) > (data.captureByStatus.auto_saved ?? 0) ? "warning" : "default"}
        />
      </div>

      <Panel title="Saves per day (14 days)">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.savesByDay}>
              <XAxis dataKey="date" tick={{ fill: '#71717a', fontSize: 11 }} />
              <YAxis tick={{ fill: '#71717a', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#0e0e10', border: '1px solid rgba(255,255,255,0.08)', fontSize: 12 }} />
              <Bar dataKey="saves" fill="#60a5fa" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel title="Capture outcomes">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-2">Auto saved</p>
            <p className="text-2xl font-semibold">{formatNumber(data.captureByStatus.auto_saved ?? 0)}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-2">Needs selection</p>
            <p className="text-2xl font-semibold">{formatNumber(data.captureByStatus.needs_selection ?? 0)}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-2">Unresolved</p>
            <p className="text-2xl font-semibold">{formatNumber(data.captureByStatus.unresolved ?? 0)}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-2">Duplicates</p>
            <p className="text-2xl font-semibold">{formatNumber(data.captureByStatus.duplicate ?? 0)}</p>
          </div>
        </div>
      </Panel>

      <Panel title="Search activity">
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-2">Hit rate</p>
            <p className="text-2xl font-semibold">{formatPercent(data.revisitRate)}</p>
            <p className="text-xs text-muted-foreground mt-1">queries returning at least one result</p>
          </div>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.searchUsage}>
                <XAxis dataKey="date" tick={{ fill: '#71717a', fontSize: 10 }} hide />
                <Tooltip contentStyle={{ background: '#0e0e10', border: '1px solid rgba(255,255,255,0.08)', fontSize: 12 }} />
                <Bar dataKey="queries" fill="#a78bfa" radius={[3, 3, 0, 0]} />
                <Bar dataKey="hits" fill="#34d399" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Panel>
    </div>
  );
}
