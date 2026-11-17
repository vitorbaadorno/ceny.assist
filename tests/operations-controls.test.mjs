import test from "node:test";
import assert from "node:assert/strict";
import { evaluateHealth } from "../scripts/operations-health.mjs";
import { recoveryKey, encryptRecovery, decryptRecovery } from "../scripts/recovery-crypto.mjs";
import { assertLedgerFresh, assertLedgerContinuity } from "../scripts/ledger-continuity.mjs";
test("alerts distinguish stuck queues, erasure, retries, provider errors and absent external evidence", () => {
  const healthy = {
    reachable: true,
    stuck_jobs: 0,
    stuck_erasures: 0,
    repeated_failures: 0,
    blocked_jobs: 0,
    attempts: 10,
    failures: 0,
    ledger_age_minutes: 1,
    daily_tokens: 10,
    unknown_token_receipts: 0,
  };
  assert.equal(evaluateHealth(healthy, { daily_token_budget: 100 }).healthy, true);
  assert.ok(evaluateHealth(healthy, { daily_token_budget: 1 }).alerts.includes("budget_exceeded"));
  assert.ok(evaluateHealth(healthy).alerts.includes("budget_unconfigured"));
  for (const key of ["stuck_jobs", "stuck_erasures", "repeated_failures", "blocked_jobs"])
    assert.ok(evaluateHealth({ ...healthy, [key]: 1 }).alerts.includes(key));
  assert.ok(evaluateHealth({ ...healthy, failures: 5 }).alerts.includes("ai_failure_rate"));
  assert.ok(
    evaluateHealth({ ...healthy, ledger_age_minutes: null }).alerts.includes("ledger_stale"),
  );
  assert.ok(
    evaluateHealth({ ...healthy, reachable: false }).alerts.includes("service_unavailable"),
  );
  assert.equal(evaluateHealth({}).healthy, false);
});
test("recovery encryption round trip rejects tampering, wrong keys and plain text", () => {
  const key = recoveryKey(Buffer.alloc(32, 7).toString("base64"));
  const plain = Buffer.from("synthetic storage bytes");
  const sealed = encryptRecovery(plain, key);
  assert.ok(!sealed.includes(plain));
  assert.deepEqual(decryptRecovery(sealed, key), plain);
  assert.throws(() => decryptRecovery(sealed, Buffer.alloc(32, 8)));
  sealed[sealed.length - 1] ^= 1;
  assert.throws(() => decryptRecovery(sealed, key));
  assert.throws(() => recoveryKey("short"));
});
test("manifest continuity refuses stale evidence or disappearance of erased identities and bytes", () => {
  const ledger = {
    project: "test",
    exported_at: "2026-11-16T12:00:00Z",
    companies: ["company"],
    erasures: [{ company_id: "company", candidate_ids: ["person"], objects: ["path"] }],
  };
  assertLedgerFresh(ledger, Date.parse("2026-11-16T12:01:00Z"));
  assert.throws(() => assertLedgerFresh(ledger, Date.parse("2026-11-16T13:00:00Z")));
  assertLedgerContinuity(ledger, ledger);
  assert.throws(() => assertLedgerContinuity(ledger, { ...ledger, erasures: [] }));
  assert.throws(() => assertLedgerContinuity(ledger, { ...ledger, companies: [] }));
});
