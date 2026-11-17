import test from "node:test";
import assert from "node:assert/strict";
import { evaluateRelease } from "../scripts/release-policy.mjs";
test("commercial gate rejects missing, stale, duplicate and wrong-commit approvals", () => {
  const now = Date.parse("2026-11-16T12:00:00Z");
  const items = Array.from({ length: 20 }, (_, i) => ({
    id: i + 1,
    status: "validated",
    reference: "restricted-evidence-reference",
    approved_by: "synthetic",
    validated_at: "2026-11-16T11:00:00Z",
    commit: "test-commit",
  }));
  assert.equal(evaluateRelease({}, "test-commit", now).verdict, "NO-GO");
  assert.equal(evaluateRelease({ items }, "test-commit", now).commercial_release, true);
  assert.equal(evaluateRelease({ items }, "other-commit", now).verdict, "NO-GO");
  assert.equal(evaluateRelease({ items: items.slice(1) }, "test-commit", now).verdict, "NO-GO");
  assert.equal(
    evaluateRelease({ items: items.filter((i) => i.id !== 8) }, "test-commit", now).verdict,
    "NO-GO",
  );
  assert.equal(
    evaluateRelease({ items: items.filter((i) => i.id !== 8) }, "test-commit", now)
      .commercial_release,
    false,
  );
  assert.equal(
    evaluateRelease({ items: [...items, items[0]] }, "test-commit", now).commercial_release,
    false,
  );
  assert.equal(
    evaluateRelease({ items }, "test-commit", now + 31 * 86400000).commercial_release,
    false,
  );
});
