import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { z } from "zod";
function load(file, dependencies = {}, entry = "") {
  const code = stripTypeScriptTypes(fs.readFileSync(file, "utf8")).replace(/^import\b[\s\S]*?;\s*/gm, "").replaceAll("export ", "");
  return new Function(...Object.keys(dependencies), code + entry)(...Object.values(dependencies));
}
test("worker with verify_jwt=false rejects missing or invalid identity before privileged work", async () => {
  let clients = 0;
  const handle = load("supabase/functions/_shared/worker-handler.ts", {
    z, Deno: { env: { get: () => "synthetic" } },
    createClient: () => { clients++; return { auth: { getUser: async () => ({ data: { user: null }, error: {} }) } }; },
  }, ";return handleRequest;");
  assert.equal((await handle(new Request("https://test.invalid", { method: "POST" }))).status, 401);
  assert.equal(clients, 0);
  assert.equal((await handle(new Request("https://test.invalid", { method: "POST", headers: { Authorization: "Bearer invalid" } }))).status, 401);
  assert.equal(clients, 1);
});
for (const file of ["ceny-queue", "analisar-curriculo"]) {
  test(`${file} refuses forged scheduler tokens without invoking queue or AI`, async () => {
    let handler, verification = 0, work = 0;
    load(`supabase/functions/${file}/index.ts`, {
      Deno: { serve: fn => { handler = fn; }, env: { get: () => "synthetic" } },
      createClient: () => ({ rpc: async () => { verification++; return { data: false, error: null }; } }),
      probeGemini: async () => { work++; }, runPrivacyQueue: async () => { work++; }, runResumeQueue: async () => { work++; },
      handleRequest: async () => new Response(null, { status: 401 }),
    });
    for (const token of ["invalid", "a".repeat(64)]) {
      const response = await handler(new Request("https://test.invalid", { method: "POST", headers: { "x-ceny-queue-token": token } }));
      assert.equal(response.status, 401);
    }
    assert.equal(verification, 1);
    assert.equal(work, 0);
    assert.equal((await handler(new Request("https://test.invalid"))).status, 405);
  });
}
