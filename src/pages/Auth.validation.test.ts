import { describe, expect, it } from "vitest";
import { getSafeRedirectPath, validateAuthFormInput } from "@/pages/authValidation";

describe("Auth validation helpers", () => {
  it("validates signup password confirmation", () => {
    const errors = validateAuthFormInput({
      mode: "signup",
      email: "valid@example.com",
      password: "secret12",
      confirmPassword: "different",
    });

    expect(errors.confirmPassword).toBe("Passwords do not match");
  });

  it("validates email format for login", () => {
    const errors = validateAuthFormInput({
      mode: "login",
      email: "invalid-email",
      password: "secret12",
      confirmPassword: "",
    });

    expect(errors.email).toBeTruthy();
  });

  it("rejects unsafe redirect values", () => {
    expect(getSafeRedirectPath("https://evil.site")).toBe("/");
    expect(getSafeRedirectPath("//evil.site")).toBe("/");
    expect(getSafeRedirectPath("/dashboard")).toBe("/dashboard");
  });
});
