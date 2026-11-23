import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

// Stub firebase/auth before any module load. AdminLayout indirectly imports
// AuthContext which calls getAuth(); without this, vitest tries to resolve
// the firebase/auth subpath in a node env and the test suite refuses to load.
vi.mock("firebase/auth", () => ({
  getAuth: vi.fn(() => ({ currentUser: null })),
  onAuthStateChanged: vi.fn(() => () => {}),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  updatePassword: vi.fn(),
  updateProfile: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  getFirestore: vi.fn(),
  enableIndexedDbPersistence: vi.fn(() => Promise.resolve()),
}));

vi.mock("firebase/storage", () => ({ getStorage: vi.fn() }));
vi.mock("firebase/functions", () => ({ getFunctions: vi.fn() }));
vi.mock("firebase/app", () => ({ initializeApp: vi.fn(() => ({})) }));

// AdminLayout only consults useAdminClaim; the auth context isn't read directly
// in the component under test, so a thin stub is enough.
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: null, loading: false }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import AdminLayout from "@/pages/admin/AdminLayout";

const mockUseAdminClaim = vi.fn();

vi.mock("@/hooks/useAdminClaim", () => ({
  useAdminClaim: () => mockUseAdminClaim(),
}));

vi.mock("@/components/ui/loading-spinner", () => ({
  LoadingSpinner: () => <div>Loading spinner</div>,
}));

function renderAdminLayout(): string {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={["/admin"]}>
      <Routes>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<div>Admin child</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("AdminLayout", () => {
  afterEach(() => {
    mockUseAdminClaim.mockReset();
  });

  it("shows an access denied state for non-admin sessions", () => {
    mockUseAdminClaim.mockReturnValue({
      loading: false,
      isAdmin: false,
      accessDenied: true,
      error: null,
      refreshAdminClaim: vi.fn(),
    });

    const html = renderAdminLayout();

    expect(html).toContain("Admin access required");
    expect(html).toContain("Refresh admin access");
    expect(html).not.toContain("Admin child");
  });

  it("shows a verification error when admin access cannot be checked", () => {
    mockUseAdminClaim.mockReturnValue({
      loading: false,
      isAdmin: false,
      accessDenied: false,
      error: "Network error. Check your connection and try again.",
      refreshAdminClaim: vi.fn(),
    });

    const html = renderAdminLayout();

    expect(html).toContain("Could not verify admin access");
    expect(html).toContain("Network error. Check your connection and try again.");
  });

  it("renders the admin outlet for authorized users", () => {
    mockUseAdminClaim.mockReturnValue({
      loading: false,
      isAdmin: true,
      accessDenied: false,
      error: null,
      refreshAdminClaim: vi.fn(),
    });

    const html = renderAdminLayout();

    expect(html).toContain("Admin child");
    expect(html).toContain("System Health");
  });
});
