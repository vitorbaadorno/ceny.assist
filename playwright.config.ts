import { defineConfig } from "@playwright/test";
import fs from "node:fs";
const isolated = process.env["CENY_BROWSER_ISOLATED"] === "true";
const local = isolated
  ? JSON.parse(fs.readFileSync("artifacts/local-supabase.json", "utf8"))
  : null;
if (local && !["localhost", "127.0.0.1"].includes(new URL(local.API_URL).hostname))
  throw new Error("Testes somente em Supabase descartável local.");
export default defineConfig({
  testDir: "tests/browser",
  workers: 1,
  retries: 0,
  timeout: 60000,
  reporter: [["list"]],
  outputDir: "artifacts/browser",
  use: { baseURL: "http://127.0.0.1:8080", trace: "off", screenshot: "off", video: "off" },
  webServer: {
    command: "node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 8080 --strictPort",
    url: "http://127.0.0.1:8080/auth",
    reuseExistingServer: false,
    timeout: 90000,
    env: {
      VITE_SUPABASE_URL: local?.API_URL ?? "http://127.0.0.1:54321",
      VITE_SUPABASE_PUBLISHABLE_KEY: local?.ANON_KEY ?? "synthetic-public-placeholder",
      SUPABASE_URL: local?.API_URL ?? "http://127.0.0.1:54321",
      SUPABASE_PUBLISHABLE_KEY: local?.ANON_KEY ?? "synthetic-public-placeholder",
    },
  },
});
