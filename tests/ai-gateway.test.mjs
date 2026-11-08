import test from "node:test";
import assert from "node:assert/strict";
import { callAiJson } from "../supabase/functions/_shared/ai.ts";
const options = {
  instructions: "fixture",
  parts: [{ type: "input_text", text: "synthetic" }],
  schemaName: "test",
  schema: { type: "object" },
};
function env(t, paid = true) {
  const prior = globalThis.Deno;
  t.after(() => (globalThis.Deno = prior));
  globalThis.Deno = {
    env: {
      get: (k) => (k === "CENY_GEMINI_DATA_TIER" ? (paid ? "paid" : "free") : "synthetic-test"),
    },
  };
}
test("Gemini uses backend auth header, low temperature, schema and reports usage", async (t) => {
  env(t);
  let receipt;
  t.mock.method(globalThis, "fetch", async (url, init) => {
    assert.match(url, /generativelanguage.googleapis.com.*gemini-2.5-flash:generateContent$/);
    assert.ok(!url.includes("synthetic-test"));
    assert.equal(init.headers["x-goog-api-key"], "synthetic-test");
    const b = JSON.parse(init.body);
    assert.equal(b.generationConfig.temperature, 0.1);
    assert.deepEqual(b.generationConfig.responseJsonSchema, options.schema);
    assert.equal(b.tools, undefined);
    return Response.json({
      candidates: [{ finishReason: "STOP", content: { parts: [{ text: '{"ok":true}' }] } }],
      usageMetadata: { totalTokenCount: 15 },
      modelVersion: "fixture",
    });
  });
  assert.deepEqual(await callAiJson({ ...options, onReceipt: (r) => (receipt = r) }), { ok: true });
  assert.equal(receipt.total_tokens, 15);
});
test("free or unreviewed processing never sends a resume", async (t) => {
  env(t, false);
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
  });
  await assert.rejects(callAiJson(options), { name: "AiPrivacyPending" });
  assert.equal(calls, 0);
});
test("provider details, blocked output, truncated and malformed JSON fail safely", async (t) => {
  env(t);
  for (const response of [
    new Response("SECRET PROVIDER BODY", { status: 429 }),
    Response.json({
      candidates: [{ finishReason: "MAX_TOKENS", content: { parts: [{ text: '{"ok":true}' }] } }],
    }),
    Response.json({ promptFeedback: { blockReason: "SAFETY" } }),
    Response.json({
      candidates: [{ finishReason: "STOP", content: { parts: [{ text: "invalid" }] } }],
    }),
  ]) {
    t.mock.method(globalThis, "fetch", async () => response);
    await assert.rejects(
      callAiJson(options),
      (e) => !e.message.includes("SECRET") && e.name === "AiGatewayError",
    );
  }
});
