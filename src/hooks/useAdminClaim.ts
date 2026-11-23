import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { evaluateAdminClaim, type AdminClaimResolution } from '@/hooks/adminClaim';

export interface AdminClaimState extends AdminClaimResolution {
  loading: boolean;
  refreshAdminClaim: () => Promise<void>;
}

type AdminClaimViewState = Omit<AdminClaimState, 'refreshAdminClaim'>;

const SIGNED_OUT_STATE: AdminClaimViewState = {
  loading: false,
  isAdmin: false,
  accessDenied: false,
  error: null,
};

export function useAdminClaim(): AdminClaimState {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<AdminClaimViewState>({
    loading: true,
    isAdmin: false,
    accessDenied: false,
    error: null,
  });

  const refreshAdminClaim = async () => {
    if (authLoading) return;
    if (!user) {
      setState(SIGNED_OUT_STATE);
      return;
    }

    setState((current) => ({
      ...current,
      loading: true,
      accessDenied: false,
      error: null,
    }));

    const next = await evaluateAdminClaim(user);
    setState({
      loading: false,
      ...next,
    });
  };

  useEffect(() => {
    let active = true;

    if (authLoading) return;
    if (!user) {
      if (active) setState(SIGNED_OUT_STATE);
      return;
    }

    setState((current) => ({
      ...current,
      loading: true,
      accessDenied: false,
      error: null,
    }));

    void evaluateAdminClaim(user).then((next) => {
      if (!active) return;
      setState({
        loading: false,
        ...next,
      });
    });

    return () => {
      active = false;
    };
  }, [user, authLoading]);

  return {
    ...state,
    refreshAdminClaim,
  };
}
