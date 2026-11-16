import test from "node:test";
import assert from "node:assert/strict";
import { runRetention, validateRetentionPolicy } from "../scripts/retention-policy.mjs";
const company = "11111111-1111-4111-8111-111111111111";
const policy = {
  version: 1,
  company_id: company,
  approval_reference: "synthetic-approval",
  approved_by: "test",
  approved_at: "2026-01-01",
  review_at: "2027-01-01",
  candidate_days: 30,
  basis: "candidate_created_at",
};
function fixture({ holds = 0, merged = false, error = false } = {}) {
  const calls = [];
  return {
    calls,
    async rpc(name, args) {
      calls.push({ name, args });
      if (error) return { error: {} };
      return {
        data:
          name === "privacy_candidates"
            ? [
                { id: "old", created_at: "2025-01-01" },
                { id: "new", created_at: "2026-11-15" },
              ]
            : name === "preview_candidate_erasure"
              ? { candidate_ids: merged ? ["old", "new"] : ["old"], holds }
              : "operation",
      };
    },
  };
}
const options = { now: new Date("2026-11-16") };
test("unapproved, expired and future retention policies fail closed", async () => {
  assert.throws(() => validateRetentionPolicy({ ...policy, approval_reference: "" }));
  for (const override of [{ review_at: "2026-01-01" }, { approved_at: "2027-01-01" }]) {
    const db = fixture();
    await assert.rejects(runRetention(db, { ...policy, ...override }, options));
    assert.equal(db.calls.length, 0);
  }
});
test("dry run never mutates; legal holds and recent merged identities prevent deletion", async () => {
  for (const params of [{}, { holds: 1 }, { merged: true }]) {
    const db = fixture(params);
    const result = await runRetention(db, policy, options);
    assert.equal(result.eligible, params.holds || params.merged ? 0 : 1);
    assert.equal(
      db.calls.some((c) => c.name === "request_candidate_erasure"),
      false,
    );
  }
});
test("approved execution delegates exact scope to transactional permission and hold checks", async () => {
  const db = fixture();
  const result = await runRetention(db, policy, { ...options, execute: true });
  assert.equal(result.queued, 1);
  assert.deepEqual(db.calls.at(-1).args.p_confirmed_ids, ["old"]);
  assert.equal(db.calls.at(-1).args.p_company, company);
  assert.ok(!JSON.stringify(result).includes("old"));
  await assert.rejects(runRetention(fixture({ error: true }), policy, options));
});
