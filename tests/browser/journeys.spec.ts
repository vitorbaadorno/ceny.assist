import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import { randomUUID } from "node:crypto";

test("anonymous access, localized errors and mobile login remain accessible", async ({ page }) => {
  await page.goto("/upload");
  await expect(page).toHaveURL(/\/auth/);
  await expect(page.getByLabel("E-mail", { exact: true })).toBeVisible();
  await page.getByLabel("E-mail", { exact: true }).fill("synthetic@example.test");
  await page.getByLabel("Senha", { exact: true }).fill("Synthetic-password-123!");
  await page.getByRole("button", { name: "Mostrar senha", exact: true }).click();
  await expect(page.getByLabel("Senha", { exact: true })).toHaveAttribute("type", "text");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("button", { name: "Entrar", exact: true })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.goto("/nonexistent-synthetic-page");
  await expect(page.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();
});

test("owner creates company and vacancy, sends synthetic document and reaches privacy controls", async ({
  page,
}) => {
  test.skip(
    process.env["CENY_BROWSER_ISOLATED"] !== "true",
    "Requires disposable Supabase; never uses production credentials.",
  );
  const config = JSON.parse(fs.readFileSync("artifacts/local-supabase.json", "utf8"));
  expect(["localhost", "127.0.0.1"]).toContain(new URL(config.API_URL).hostname);
  const admin = createClient(config.API_URL, config.SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const email = `browser-${randomUUID()}@test.invalid`,
    password = `Synthetic!${randomUUID()}Aa1`;
  const result = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  expect(result.error).toBeNull();
  await page.goto("/auth");
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByLabel("Nome da empresa", { exact: true })).toBeVisible();
  await page.getByLabel("Nome da empresa", { exact: true }).fill("Empresa sintética navegador");
  await page.getByLabel("Nome completo do responsável").fill("Responsável sintético");
  await page.getByRole("button", { name: "Criar empresa", exact: true }).click();
  await expect(page.getByLabel("Empresa ativa")).toContainText("Empresa sintética navegador");
  await page.getByRole("link", { name: "Vagas", exact: true }).click();
  await page.getByRole("button", { name: "Nova vaga", exact: true }).click();
  await page.getByLabel("Título", { exact: true }).fill("Analista sintético");
  await page.getByLabel("Descrição", { exact: true }).fill("Trabalho profissional com SQL.");
  await page.getByRole("button", { name: "Salvar rascunho", exact: true }).click();
  await expect(page.getByRole("link").filter({ hasText: "Analista sintético" })).toBeVisible();
  await page.getByRole("link", { name: "Enviar currículos", exact: true }).click();
  await page.getByLabel("Selecionar currículos").setInputFiles("tests/fixtures/quality/table.docx");
  await page.getByRole("button", { name: "Iniciar envio", exact: true }).click();
  await expect(page.getByRole("button", { name: "Iniciar envio", exact: true })).toBeDisabled();
  await expect(page.getByText("table.docx").first()).toBeVisible();
  await page.getByRole("button", { name: "Privacidade e dados", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Definições pendentes de aprovação" }),
  ).toBeVisible();
  // SQL/HTTP suites cover review, ranking, exports, archive and erasure independently.
  // A full approved AI/human browser journey remains a staging release criterion.
});
