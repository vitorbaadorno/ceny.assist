import { test, expect } from "@playwright/test";

test("successful sign-in renders first-company onboarding", async ({ page }) => {
  const user = {
    id: "10000000-0000-4000-8000-000000000001",
    aud: "authenticated",
    role: "authenticated",
    email: "synthetic@example.test",
    app_metadata: {},
    user_metadata: {},
    created_at: new Date().toISOString(),
  };
  const payload = Buffer.from(
    JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 }),
  ).toString("base64url");
  await page.route("**/auth/v1/**", async (route) => {
    const body = new URL(route.request().url()).pathname.endsWith("/token")
      ? {
          access_token: `eyJhbGciOiJIUzI1NiJ9.${payload}.synthetic`,
          refresh_token: "synthetic-refresh",
          expires_in: 3600,
          token_type: "bearer",
          user,
        }
      : user;
    await route.fulfill({ json: body });
  });
  await page.route("**/rest/v1/**", (route) => route.fulfill({ json: [] }));
  await page.goto("/auth");
  await page.getByLabel("E-mail", { exact: true }).fill(user.email);
  await page.getByLabel("Senha", { exact: true }).fill("Synthetic-password-123!");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByLabel("Nome da empresa", { exact: true })).toBeVisible();
});
