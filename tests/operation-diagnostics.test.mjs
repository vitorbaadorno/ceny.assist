import assert from "node:assert/strict";
import test from "node:test";
import { monitoredFetch } from "../src/lib/operation-diagnostics.ts";
test("concurrent failures keep independent tenant and operation; all logs use fixed fields", async (t) => {
  const tenants = [crypto.randomUUID(), crypto.randomUUID()],
    reports = [],
    logs = [];
  t.mock.method(console, "error", (entry) => logs.push(entry));
  const base = "https://example.invalid";
  t.mock.method(globalThis, "fetch", async (input, init) => {
    if (String(input).endsWith("ops_report_error")) {
      reports.push(JSON.parse(init.body));
      return new Response(null, { status: 204 });
    }
    const { p_company } = JSON.parse(init.body);
    if (p_company === tenants[0]) await new Promise((resolve) => setTimeout(resolve, 10));
    return new Response("private response", { status: p_company === tenants[0] ? 403 : 409 });
  });
  await Promise.all(
    tenants.map((p_company) =>
      monitoredFetch(base, base + "/rest/v1/rpc/save_job", {
        method: "POST",
        headers: { Authorization: "Bearer synthetic-private", apikey: "synthetic-api-key" },
        body: JSON.stringify({ p_company, p_payload: "private resume" }),
      }),
    ),
  );
  assert.equal(reports.length, 2);
  assert.equal(new Set(reports.map((r) => r.p_operation)).size, 2);
  for (const [i, id] of tenants.entries()) {
    const record = reports.find((r) => r.p_company === id);
    assert.equal(record.p_code, i === 0 ? "permission" : "conflict");
    assert.ok(logs.some((entry) => entry.operation === record.p_operation));
  }
  assert.doesNotMatch(JSON.stringify([...reports, ...logs]), /synthetic|private|save_job|https:/);
});
