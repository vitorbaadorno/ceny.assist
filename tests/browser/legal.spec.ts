import { test, expect } from "@playwright/test";
test("legal drafts are accessible without authentication and retain pending approval", async ({
  page,
}) => {
  for (const route of ["privacidade", "termos", "cookies"]) {
    await page.goto(`/${route}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("note")).toContainText("MINUTA — NÃO VALIDADA JURIDICAMENTE");
    await expect(page.locator("article")).toContainText("PENDENTE_VALIDACAO");
    await expect(page.locator("article")).toContainText("Versão: 0.1");
    await expect(page.getByRole("navigation", { name: "Documentos para revisão" })).toBeVisible();
  }
});
