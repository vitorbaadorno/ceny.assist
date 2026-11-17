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

test("owner creates company and vacancy, uploads, reviews and archives a synthetic candidate", async ({
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
  const diagnostics: { path: string; status: number }[] = [];
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (url.origin === new URL(config.API_URL).origin)
      diagnostics.push({ path: url.pathname, status: response.status() });
  });
  await page.goto("/auth");
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  const login = page.waitForResponse(
    (response) => new URL(response.url()).pathname === "/auth/v1/token",
  );
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  expect((await login).status()).toBe(200);
  try {
    await expect(page.getByLabel("Nome da empresa", { exact: true })).toBeVisible({
      timeout: 20000,
    });
  } catch (error) {
    console.log(
      "Synthetic browser diagnostics",
      JSON.stringify({
        requests: diagnostics,
        path: new URL(page.url()).pathname,
        companyError: await page
          .getByText("Não foi possível consultar suas empresas. Recarregue a página.")
          .isVisible(),
        pageError: await page
          .getByRole("heading", { name: "Não foi possível carregar esta página" })
          .isVisible(),
      }),
    );
    throw error;
  }
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
  const upload = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname.endsWith("/ceny-worker") && url.searchParams.get("action") === "upload";
  });
  await page.getByRole("button", { name: "Iniciar envio", exact: true }).click();
  const uploaded = await upload;
  expect(uploaded.status()).toBe(200);
  const receipt = await uploaded.json();
  expect(typeof receipt.documentId).toBe("string");
  const stored = await admin
    .from("resume_documents")
    .select("id,state")
    .eq("id", receipt.documentId)
    .single();
  expect(stored.error).toBeNull();
  expect(stored.data?.id).toBe(receipt.documentId);
  await expect(page.getByRole("button", { name: "Iniciar envio", exact: true })).toBeDisabled();
  await expect(page.getByText("table.docx").first()).toBeVisible();
  await page.getByRole("button", { name: "Privacidade e dados", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Definições pendentes de aprovação" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Candidatos", exact: true }).click();
  await page.goto(`/candidatos/${receipt.candidateId}`);
  await page.getByLabel("Nome", { exact: true }).fill("Pessoa sintética revisada");
  await page.getByRole("checkbox", { name: /Conferi o currículo original/ }).check();
  await page.getByRole("button", { name: "Concluir revisão", exact: true }).click();
  await expect(page.getByText("Revisado pelo RH", { exact: true }).first()).toBeVisible();
  const reviewed = await admin
    .from("candidates")
    .select("review_status,nome")
    .eq("id", receipt.candidateId)
    .single();
  expect(reviewed.data?.review_status).toBe("completed");
  expect(reviewed.data?.nome).toBe("Pessoa sintética revisada");
  await page.getByRole("button", { name: "Arquivar", exact: true }).click();
  await page.getByRole("button", { name: "Arquivar currículo", exact: true }).click();
  await expect(page).toHaveURL("/");
  const archived = await admin
    .from("candidates")
    .select("excluido")
    .eq("id", receipt.candidateId)
    .single();
  expect(archived.data?.excluido).toBe(true);
  // SQL/HTTP suites cover review, ranking, exports, archive and erasure independently.
  // A full approved AI/human browser journey remains a staging release criterion.
});
