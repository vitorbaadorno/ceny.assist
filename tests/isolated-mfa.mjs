import fs from "node:fs";
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { allowSyntheticRegistration } from "./local-pilot-registration.mjs";
const config = JSON.parse(fs.readFileSync("artifacts/local-supabase.json", "utf8"));
assert.ok(["localhost", "127.0.0.1"].includes(new URL(config.API_URL).hostname));
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(config.API_URL, config.SERVICE_ROLE_KEY, options);
const user = createClient(config.API_URL, config.ANON_KEY, options);
const email = `mfa-${randomUUID()}@test.invalid`,
  password = `Synthetic!${randomUUID()}Aa1`;
allowSyntheticRegistration(config, email);
const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
assert.ifError(created.error);
let company;
const results = [];
async function check(name, fn) {
  await fn();
  results.push({ name, passed: true });
  console.log("PASS", name);
}
function totp(secret) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bits = [...secret.replace(/=+$/, "").toUpperCase()]
    .map((c) => alphabet.indexOf(c).toString(2).padStart(5, "0"))
    .join("");
  const bytes = Buffer.from(bits.match(/.{8}/g).map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const digest = createHmac("sha1", bytes).update(counter).digest(),
    offset = digest.at(-1) & 15;
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(6, "0");
}
try {
  assert.ifError((await user.auth.signInWithPassword({ email, password })).error);
  const c = await user.rpc("create_company", {
    p_name: "Synthetic MFA",
    p_responsible: "Synthetic owner",
  });
  assert.ifError(c.error);
  company = c.data;
  const enrolled = await user.auth.mfa.enroll({ factorType: "totp" });
  assert.ifError(enrolled.error);
  await check("malformed second factor is rejected", async () => {
    assert.ok(
      (await user.auth.mfa.challengeAndVerify({ factorId: enrolled.data.id, code: "invalid" }))
        .error,
    );
  });
  await check("valid synthetic TOTP upgrades the session", async () => {
    assert.ifError(
      (
        await user.auth.mfa.challengeAndVerify({
          factorId: enrolled.data.id,
          code: totp(enrolled.data.totp.secret),
        })
      ).error,
    );
    assert.equal((await user.auth.mfa.getAuthenticatorAssuranceLevel()).data.currentLevel, "aal2");
  });
  await user.auth.signOut();
  assert.ifError((await user.auth.signInWithPassword({ email, password })).error);
  await check(
    "password alone cannot read tenant data or invoke privileged Edge work after enrollment",
    async () => {
      const pending = await user.rpc("session_requires_mfa");
      assert.ifError(pending.error);
      assert.equal(pending.data, true);
      const companies = await user.from("companies").select("id");
      assert.ifError(companies.error);
      assert.equal(companies.data.length, 0);
      const edge = await user.functions.invoke("ceny-worker", {
        body: { action: "extract", companyId: company, candidateId: randomUUID() },
      });
      assert.equal(edge.error?.context?.status, 403);
    },
  );
  await check("confirmed second factor restores authorized access", async () => {
    // Avoid replaying the already accepted time step.
    await new Promise((resolve) => setTimeout(resolve, 31000 - (Date.now() % 30000)));
    assert.ifError(
      (
        await user.auth.mfa.challengeAndVerify({
          factorId: enrolled.data.id,
          code: totp(enrolled.data.totp.secret),
        })
      ).error,
    );
    const companies = await user.from("companies").select("id");
    assert.ifError(companies.error);
    assert.equal(companies.data.length, 1);
    assert.equal((await user.rpc("session_requires_mfa")).data, false);
  });
  await check("verified user can deliberately remove their own synthetic factor", async () => {
    assert.ifError((await user.auth.mfa.unenroll({ factorId: enrolled.data.id })).error);
    assert.equal((await user.auth.mfa.listFactors()).data.totp.length, 0);
  });
  fs.writeFileSync("artifacts/mfa-results.json", JSON.stringify(results));
} finally {
  if (company) assert.ifError((await admin.from("companies").delete().eq("id", company)).error);
  assert.ifError((await admin.auth.admin.deleteUser(created.data.user.id)).error);
}
