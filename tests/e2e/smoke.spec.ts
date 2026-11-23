import { test, expect } from "@playwright/test";

test("public app shell and authentication route load", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /save it when you see it/i }),
  ).toBeVisible({ timeout: 20_000 });

  await page.goto("/auth");
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
});
