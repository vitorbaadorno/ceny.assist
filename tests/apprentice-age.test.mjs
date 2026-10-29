import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateAge,
  isCivilDate,
  ageReferenceDate,
  assessApprenticeAge,
} from "../supabase/functions/_shared/age.ts";
import { scoreCandidate } from "../supabase/functions/_shared/scoring.ts";
import { extractionValidator } from "../supabase/functions/_shared/extraction-quality.ts";
import { extractionFixture } from "./extraction-fixture.mjs";

test("general apprenticeship range includes 14th birthday and excludes 24th", () => {
  assert.equal(assessApprenticeAge("2012-10-29", "2026-10-28").state, "special_review");
  assert.equal(assessApprenticeAge("2012-10-28", "2026-10-28").state, "general_range");
  assert.equal(assessApprenticeAge("2002-10-29", "2026-10-28").state, "general_range");
  assert.equal(assessApprenticeAge("2002-10-28", "2026-10-28").state, "special_review");
});
test("unknown birth date remains pending, without fabricated age or exclusion decision", () => {
  for (const value of [null, undefined, ""]) {
    const r = assessApprenticeAge(value, "2026-10-28");
    assert.equal(r.state, "birth_date_pending");
    assert.equal(r.age, null);
    assert.equal(r.legal_validation, "pending");
    assert.ok(!("eligible" in r));
  }
});
test("impossible dates and leap century boundaries are validated strictly", () => {
  for (const value of [
    "2023-02-29",
    "1900-02-29",
    "2100-02-29",
    "2000-04-31",
    "2000-13-01",
    "2000-00-10",
    "2000-01-00",
    "2000-1-01",
    "2000-01-01T00:00:00Z",
    "not-a-date",
  ])
    assert.equal(isCivilDate(value), false, value);
  for (const value of ["2000-02-29", "2004-02-29", "2024-02-29", "1900-03-01"])
    assert.equal(isCivilDate(value), true, value);
  assert.equal(calculateAge("2000-02-29", "2023-02-28"), 22);
  assert.equal(calculateAge("2000-02-29", "2023-03-01"), 23);
  assert.equal(calculateAge("2000-02-29", "2024-02-29"), 24);
});
test("future birth date is invalid and invalid reference fails closed", () => {
  assert.equal(assessApprenticeAge("2026-10-29", "2026-10-28").state, "invalid_birth_date");
  assert.equal(calculateAge("2026-10-29", "2026-10-28"), null);
  assert.throws(() => assessApprenticeAge("2000-01-01", "2026-02-30"));
});
test("reference uses Sao Paulo civil date and persisted reference remains reproducible", () => {
  assert.equal(ageReferenceDate(new Date("2026-10-29T02:59:59Z")), "2026-10-28");
  assert.equal(ageReferenceDate(new Date("2026-10-29T03:00:00Z")), "2026-10-29");
  const reference = ageReferenceDate(new Date("2026-10-29T02:00:00Z"));
  assert.equal(assessApprenticeAge("2002-10-29", reference).state, "general_range");
  assert.deepEqual(
    assessApprenticeAge("2002-10-29", reference),
    assessApprenticeAge("2002-10-29", "2026-10-28"),
  );
});
test("birth date and alleged sensitive traits never change job adherence", () => {
  const job = {
    categoria: "jovem_aprendiz",
    criteria: [
      { kind: "skill", text: "SQL", required: true, weight: 5, min_years: null, source: null },
    ],
  };
  const base = { skills: ["SQL"], dados_extraidos: { skills: ["SQL"] } };
  for (const dob of [null, "2015-01-01", "2008-01-01", "1990-01-01"])
    assert.deepEqual(
      scoreCandidate({ ...base, data_nascimento: dob, deficiencia: "inferred" }, job),
      scoreCandidate(base, job),
    );
});
test("extraction schema refuses sensitive condition fields instead of persisting them", () => {
  for (const key of ["deficiencia", "diagnostico", "raca", "religiao"])
    assert.equal(
      extractionValidator.safeParse({ ...extractionFixture(), [key]: "inferred" }).success,
      false,
    );
});
