import { getSafeErrorMessage } from '@/lib/errorMessage';

export interface AdminClaimReader {
  getIdTokenResult: (forceRefresh?: boolean) => Promise<{ claims: Record<string, unknown> }>;
}

export interface AdminClaimResolution {
  isAdmin: boolean;
  accessDenied: boolean;
  error: string | null;
}

const ADMIN_CLAIM_REFRESH_ATTEMPTS = 2;
const ADMIN_CLAIM_CHECK_ERROR =
  "We couldn't verify your admin access right now. Please try again.";

export async function readAdminClaim(
  reader: AdminClaimReader,
  attempts = ADMIN_CLAIM_REFRESH_ATTEMPTS,
): Promise<boolean> {
  let isAdmin = false;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const result = await reader.getIdTokenResult(true);
    isAdmin = result.claims.admin === true;
    if (isAdmin) return true;
  }

  return false;
}

export async function evaluateAdminClaim(reader: AdminClaimReader): Promise<AdminClaimResolution> {
  try {
    const isAdmin = await readAdminClaim(reader);
    return {
      isAdmin,
      accessDenied: !isAdmin,
      error: null,
    };
  } catch (error) {
    return {
      isAdmin: false,
      accessDenied: false,
      error: getSafeErrorMessage(error, ADMIN_CLAIM_CHECK_ERROR),
    };
  }
}
