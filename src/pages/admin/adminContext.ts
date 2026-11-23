import { useOutletContext } from 'react-router-dom';

export interface AdminOutletContext {
  isAdmin: boolean;
  refreshAdminClaim: () => Promise<void>;
}

export function useAdminOutletContext(): AdminOutletContext {
  return useOutletContext<AdminOutletContext>();
}
