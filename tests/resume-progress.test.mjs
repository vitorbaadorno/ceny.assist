import test from "node:test";
import assert from "node:assert/strict";
import { documentState, uploadSummary } from "../src/lib/resume-progress.ts";
test("all failures produce zero successes and no pending files", () => {
  assert.deepEqual(uploadSummary([{ state: "erro" }, { state: "erro" }]), {
    completed: 0,
    unknown: 0,
    review: 0,
    failed: 2,
    pending: 0,
    duplicates: 0,
  });
});
test("mixed batch separates completed, review, errors, pending and reused documents", () => {
  assert.deepEqual(
    uploadSummary(
      ["completed", "review", "error", "uploaded", "reading", "receiving"].map((state) => ({
        state: documentState(state),
        duplicate: state === "completed",
      })),
    ),
    { completed: 1, unknown: 0, review: 1, failed: 1, pending: 3, duplicates: 1 },
  );
});
