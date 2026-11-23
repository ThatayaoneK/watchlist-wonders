import { useQuery, type QueryKey } from '@tanstack/react-query';
import { errorHasCode, getSafeErrorMessage } from '@/lib/errorMessage';
import { useAdminOutletContext } from './adminContext';

interface AdminPageQueryOptions<TData> {
  queryKey: QueryKey;
  queryFn: () => Promise<TData>;
  fallbackMessage: string;
  refetchInterval?: number;
}

export function getAdminQueryErrorMessage(error: unknown, fallbackMessage: string): string {
  if (errorHasCode(error, ['permission-denied', 'unauthenticated'])) {
    return 'Your current session could not load admin data. Refresh admin access, then sign out and back in if needed.';
  }

  return getSafeErrorMessage(error, fallbackMessage);
}

export function useAdminPageQuery<TData>({
  queryKey,
  queryFn,
  fallbackMessage,
  refetchInterval,
}: AdminPageQueryOptions<TData>) {
  const { isAdmin, refreshAdminClaim } = useAdminOutletContext();
  const query = useQuery<TData>({
    queryKey,
    queryFn,
    enabled: isAdmin,
    refetchInterval,
  });

  const retryAdminQuery = async () => {
    await refreshAdminClaim();
    return query.refetch();
  };

  return {
    ...query,
    errorMessage: query.error ? getAdminQueryErrorMessage(query.error, fallbackMessage) : null,
    retryAdminQuery,
  };
}
