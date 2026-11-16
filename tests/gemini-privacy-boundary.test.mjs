import test from "node:test";
import assert from "node:assert/strict";
import { callAiJson, probeGemini } from "../supabase/functions/_shared/ai.ts";
import { extractResume } from "../supabase/functions/_shared/resumes.ts";
import { pdfFixture, docxFixture } from "./resume-fixtures.mjs";
const options = { instructions: "synthetic", parts: [{ type: "input_text", text: "synthetic" }], schema: { type: "object" }, schemaName: "test" };
function configure(t, config) {
  const old = globalThis.Deno;
  globalThis.Deno = { env: { get: key => config[key] } };
  t.after(() => { globalThis.Deno = old; });
}
test("every unsupported tier and missing legal reference stops network I/O", async t => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => { calls++; throw Error(); });
  for (const tier of [undefined, "free", "FREE", "paid ", "enterprise", ""]) {
    configure(t, { CENY_GEMINI_DATA_TIER: tier, CENY_GEMINI_PRIVACY_REVIEW_REFERENCE: "review" });
    await assert.rejects(callAiJson(options), { name: "AiPrivacyPending" });
  }
  for (const reference of [undefined, "", "  "]) {
    configure(t, { CENY_GEMINI_DATA_TIER: "paid", CENY_GEMINI_PRIVACY_REVIEW_REFERENCE: reference });
    await assert.rejects(callAiJson(options), { name: "AiPrivacyPending" });
  }
  assert.equal(calls, 0);
});
test("actual PDF and DOCX extraction cannot send personal data on free quota", async t => {
  configure(t, { CENY_GEMINI_DATA_TIER: "free", GEMINI_API_KEY: "synthetic" });
  const network = t.mock.method(globalThis, "fetch", async () => { throw Error("unexpected network"); });
  for (const [name, bytes] of [["resume.pdf", await pdfFixture()], ["resume.docx", docxFixture()]]) {
    await assert.rejects(extractResume(bytes, name, AbortSignal.timeout(5000)), { name: "AiPrivacyPending" });
  }
  assert.equal(network.mock.callCount(), 0);
});
test("free health check has exclusively fixed synthetic content and bounded timeout", async t => {
  configure(t, { CENY_GEMINI_DATA_TIER: "free", GEMINI_API_KEY: "synthetic" });
  t.mock.method(globalThis, "fetch", async (_url, init) => {
    assert.equal(JSON.parse(init.body).contents[0].parts[0].text, "Synthetic test. Return ok=true.");
    assert.ok(init.signal);
    return Response.json({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: '{"ok":true}' }] } }] });
  });
  assert.equal((await probeGemini()).ok, true);
});
