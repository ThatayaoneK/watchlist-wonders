import { describe, expect, it } from "vitest";
import { getAdminQueryErrorMessage } from "@/pages/admin/useAdminPageQuery";

describe("getAdminQueryErrorMessage", () => {
  it("uses admin-specific guidance for permission failures", () => {
    expect(
      getAdminQueryErrorMessage(
        { code: "functions/permission-denied" },
        "Fallback",
      ),
    ).toContain("Refresh admin access");
  });

  it("falls back to shared safe messages for non-admin errors", () => {
    expect(
      getAdminQueryErrorMessage(
        { code: "unavailable" },
        "Fallback",
      ),
    ).toBe("The service is temporarily unavailable. Please try again.");
  });
});
