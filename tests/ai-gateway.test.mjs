import test from "node:test";
import assert from "node:assert/strict";
import { callAiJson } from "../supabase/functions/_shared/ai.ts";
test("gateway uses fixed schema and privacy setting, propagates signal and reports terminal usage", async (t) => {
  const oldFetch = globalThis.fetch,
    oldDeno = globalThis.Deno;
  t.after(() => {
    globalThis.fetch = oldFetch;
    globalThis.Deno = oldDeno;
  });
  globalThis.Deno = { env: { get: () => "synthetic-key" } };
  const text = '{"nome":"Ana"}';
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://ai.gateway.lovable.dev/v1/responses");
    const body = JSON.parse(options.body);
    assert.equal(body.store, false);
    assert.equal(body.stream, true);
    assert.equal(body.text.format.strict, true);
    assert.equal(body.tools, undefined);
    assert.ok(options.signal);
    const event = {
      type: "response.completed",
      response: {
        id: "synthetic",
        status: "completed",
        model: "test-model",
        output_text: text,
        usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
      },
    };
    return new Response(`data: ${JSON.stringify(event)}\n\n`);
  };
  let receipt;
  const result = await callAiJson({
    instructions: "synthetic",
    parts: [],
    schemaName: "test",
    schema: {},
    signal: new AbortController().signal,
    onReceipt: (r) => {
      receipt = r;
    },
  });
  assert.deepEqual(result, { nome: "Ana" });
  assert.equal(receipt.total_tokens, 15);
});
test("HTTP provider errors never expose provider details or become valid JSON output", async (t) => {
  const oldFetch = globalThis.fetch,
    oldDeno = globalThis.Deno;
  t.after(() => {
    globalThis.fetch = oldFetch;
    globalThis.Deno = oldDeno;
  });
  globalThis.Deno = { env: { get: () => "synthetic-key" } };
  globalThis.fetch = async () => new Response("PRIVATE EMAIL AND PROVIDER DETAIL", { status: 500 });
  await assert.rejects(
    callAiJson({ instructions: "test", parts: [], schemaName: "test", schema: {} }),
    (e) => e.status === 500 && !e.message.includes("PRIVATE"),
  );
});
