import test from "node:test";
import assert from "node:assert/strict";
import { readAiStream } from "../supabase/functions/_shared/ai-stream.ts";
const frame = (event) => `data: ${JSON.stringify(event)}\n\n`;
const completed = (text) => ({
  type: "response.completed",
  response: {
    id: "synthetic",
    status: "completed",
    model: "fixture-model",
    error: null,
    incomplete_details: null,
    usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
    output: [
      {
        type: "message",
        role: "assistant",
        status: "completed",
        content: [{ type: "output_text", text }],
      },
    ],
  },
});
const stream = (text, size = 7) =>
  new ReadableStream({
    start(c) {
      const bytes = new TextEncoder().encode(text);
      for (let i = 0; i < bytes.length; i += size) c.enqueue(bytes.slice(i, i + size));
      c.close();
    },
  });
test("SSE handles split UTF-8, split CRLF, comments, multi-line data and terminal receipt", async () => {
  const text = JSON.stringify({ nome: "João 日本" }),
    end = completed(text);
  let receipt;
  const result = await readAiStream(
    stream(
      (
        ":heartbeat\n\n" +
        frame({ type: "response.output_text.delta", delta: text }) +
        frame(end)
      ).replaceAll("\n", "\r\n"),
      1,
    ),
    (r) => {
      receipt = r;
    },
  );
  assert.deepEqual(result.value, { nome: "João 日本" });
  assert.equal(receipt.total_tokens, 15);
  const multi =
    JSON.stringify(end, null, 2)
      .split("\n")
      .map((line) => "data: " + line)
      .join("\n") + "\n\n";
  assert.deepEqual((await readAiStream(stream(multi))).value, result.value);
});
test("valid JSON delta without completed event is never success", async () => {
  await assert.rejects(
    readAiStream(stream(frame({ type: "response.output_text.delta", delta: '{"nome":"Ana"}' }))),
  );
});
test("provider failure, incomplete, refusal and error override apparently complete text", async () => {
  for (const type of ["response.failed", "response.incomplete", "error", "response.refusal.delta"])
    await assert.rejects(
      readAiStream(
        stream(
          frame({ type: "response.output_text.delta", delta: "{}" }) +
            frame({ type, response: { status: "failed", error: { message: "SECRET PII" } } }),
        ),
      ),
      (e) => !e.message.includes("SECRET"),
    );
  const bad = completed("{}");
  bad.response.error = { message: "PRIVATE" };
  await assert.rejects(readAiStream(stream(frame(bad))));
});
test("empty, malformed, mismatching, duplicate and truncated event frames are rejected", async () => {
  for (const text of [
    "",
    "data: not-json\n\n",
    frame(completed("")),
    frame(completed("{")),
    frame(completed("{}")).trim(),
    frame(completed("{}")) + frame(completed("{}")),
    frame({ type: "response.output_text.delta", delta: '{"x":1}' }) + frame(completed("{}")),
  ])
    await assert.rejects(readAiStream(stream(text)));
});
test("network error after partial output is sanitized and does not complete", async () => {
  const body = new ReadableStream({
    start(c) {
      c.enqueue(
        new TextEncoder().encode(frame({ type: "response.output_text.delta", delta: "{}" })),
      );
      c.error(new Error("SECRET EMAIL"));
    },
  });
  await assert.rejects(readAiStream(body), (e) => !e.message.includes("SECRET"));
});
test("absent usage remains unknown and invalid usage is not reported as zero", async () => {
  const end = completed("{}");
  end.response.usage = { input_tokens: -1, output_tokens: "20" };
  const { receipt } = await readAiStream(stream(frame(end)));
  assert.equal(receipt.input_tokens, null);
  assert.equal(receipt.output_tokens, null);
  assert.equal(receipt.total_tokens, null);
});
