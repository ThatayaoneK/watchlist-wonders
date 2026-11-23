import { z } from "zod";

export type AuthMode = "login" | "signup" | "forgot";
export type AuthFieldErrors = { email?: string; password?: string; confirmPassword?: string };

export function getPasswordStrength(pw: string): 0 | 1 | 2 | 3 {
  if (pw.length === 0) return 0;
  if (pw.length < 6) return 1;
  const hasUpper = /[A-Z]/.test(pw);
  const hasNumber = /[0-9]/.test(pw);
  const hasSpecial = /[^A-Za-z0-9]/.test(pw);
  const extras = [hasUpper, hasNumber, hasSpecial].filter(Boolean).length;
  if (pw.length >= 12 && extras >= 2) return 3;
  if (pw.length >= 8 && extras >= 1) return 2;
  return 1;
}

const authSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, { message: "Email is required" })
    .email({ message: "Please enter a valid email address" })
    .max(255, { message: "Email must be less than 255 characters" }),
  password: z
    .string()
    .min(6, { message: "Password must be at least 6 characters" })
    .max(72, { message: "Password must be less than 72 characters" }),
});

export function validateEmailForReset(email: string): string | null {
  const emailResult = authSchema.shape.email.safeParse(email.trim());
  if (!emailResult.success) {
    return emailResult.error.errors[0]?.message || "Please enter a valid email address";
  }
  return null;
}

export function validateAuthFormInput(params: {
  mode: AuthMode;
  email: string;
  password: string;
  confirmPassword: string;
}): AuthFieldErrors {
  const { mode, email, password, confirmPassword } = params;
  const result = authSchema.safeParse({ email, password });
  const fieldErrors: AuthFieldErrors = {};

  if (!result.success) {
    result.error.errors.forEach((err) => {
      if (err.path[0] === "email") fieldErrors.email = err.message;
      if (err.path[0] === "password") fieldErrors.password = err.message;
    });
  }

  if (mode === "signup" && !fieldErrors.password && password !== confirmPassword) {
    fieldErrors.confirmPassword = "Passwords do not match";
  }

  return fieldErrors;
}

export function getSafeRedirectPath(rawRedirect: string | null): string {
  if (!rawRedirect) return "/";
  if (!rawRedirect.startsWith("/")) return "/";
  if (rawRedirect.startsWith("//")) return "/";
  return rawRedirect;
}
