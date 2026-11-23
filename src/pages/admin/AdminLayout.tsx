import { NavLink, Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Brain,
  ChevronRight,
  GitBranch,
  LogOut,
  Repeat,
  Shield,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAdminClaim } from '@/hooks/useAdminClaim';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { cn } from '@/lib/utils';
import type { AdminOutletContext } from './adminContext';

const NAV = [
  { to: '/admin/health', label: 'System Health', icon: Activity },
  { to: '/admin/users', label: 'User Behavior', icon: Users },
  { to: '/admin/intelligence', label: 'Intelligence Quality', icon: Brain },
  { to: '/admin/graph', label: 'Content Graph', icon: GitBranch },
  { to: '/admin/retention', label: 'Retention', icon: Repeat },
];

function useCurrentPageLabel() {
  const { pathname } = useLocation();
  return NAV.find((n) => pathname.startsWith(n.to))?.label ?? 'Admin';
}

export default function AdminLayout() {
  const { loading, isAdmin, accessDenied, error, refreshAdminClaim } = useAdminClaim();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const pageLabel = useCurrentPageLabel();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const userInitial = (user?.displayName ?? user?.email ?? 'A')[0].toUpperCase();
  const userLabel = user?.displayName || user?.email || 'Admin';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <AdminGateState
        accessDenied={accessDenied}
        error={error}
        onRetry={refreshAdminClaim}
      />
    );
  }

  const outletContext: AdminOutletContext = { isAdmin, refreshAdminClaim };

  return (
    <div className="flex h-screen overflow-hidden bg-[#0d0d0f] text-foreground">
      {/* Sidebar */}
      <aside className="flex w-56 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950">
        {/* Brand */}
        <div className="flex items-center gap-3 border-b border-zinc-800 px-4 py-[14px]">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 ring-1 ring-primary/25">
            <Shield className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] leading-none text-zinc-500">Watchlist Wonders</p>
            <p className="mt-0.5 text-sm font-semibold leading-none text-zinc-100">Admin Console</p>
          </div>
        </div>

        {/* Back to app */}
        <div className="border-b border-zinc-800 px-3 py-2">
          <Link
            to="/dashboard"
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-zinc-500 transition-colors hover:bg-white/[0.04] hover:text-zinc-300"
          >
            <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
            Back to app
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-3">
          <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
            Monitoring
          </p>
          <div className="space-y-0.5">
            {NAV.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors',
                    isActive
                      ? 'bg-white/[0.07] text-white'
                      : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      className={cn(
                        'h-4 w-4 shrink-0 transition-colors',
                        isActive ? 'text-primary' : 'text-zinc-500',
                      )}
                    />
                    <span className="flex-1">{label}</span>
                    {isActive && (
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </nav>

        {/* User + logout */}
        <div className="border-t border-zinc-800 p-3">
          <div className="flex items-center gap-2.5 rounded-lg bg-white/[0.04] px-3 py-2.5 ring-1 ring-inset ring-white/[0.05]">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
              {userInitial}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-zinc-200">{userLabel}</p>
              <p className="text-[10px] text-zinc-500">Administrator</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-zinc-500 hover:bg-red-500/10 hover:text-red-400"
              title="Sign out"
              onClick={() => void handleSignOut()}
            >
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-950/60 px-6 backdrop-blur-sm">
          <div className="flex items-center gap-1.5 text-sm">
            <span className="text-zinc-500">Admin</span>
            <ChevronRight className="h-3.5 w-3.5 text-zinc-700" />
            <span className="font-medium text-zinc-200">{pageLabel}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            <span className="text-xs text-zinc-500">Live</span>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet context={outletContext} />
        </main>
      </div>
    </div>
  );
}

export function AdminGateState({
  accessDenied,
  error,
  onRetry,
}: {
  accessDenied: boolean;
  error: string | null;
  onRetry: () => Promise<void>;
}) {
  const title = accessDenied ? 'Admin access required' : 'Could not verify admin access';
  const detail = accessDenied
    ? 'Your current session does not have the admin claim. If access was just granted, refresh admin access first. If it still fails, sign out and sign back in.'
    : (error ?? 'We could not verify your admin access right now. Please try again.');

  return (
    <div className="min-h-screen bg-zinc-950 px-6 py-10 text-foreground">
      <div className="mx-auto max-w-2xl">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="rounded-full border border-amber-400/30 bg-amber-400/10 p-3 text-amber-300">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-amber-300/80">Admin</p>
              <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            </div>
          </div>
          <p className="mt-5 max-w-xl text-sm leading-6 text-zinc-400">{detail}</p>
          <p className="mt-3 text-sm text-zinc-500">
            Admin pages require a fresh Firebase token carrying <code className="rounded bg-zinc-800 px-1 py-0.5 text-xs">admin: true</code>.
          </p>
          <div className="mt-6">
            <Button
              type="button"
              onClick={() => {
                void onRetry();
              }}
            >
              Refresh admin access
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
