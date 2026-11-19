import test from "node:test";
import assert from "node:assert/strict";
import { assertPublicApiKey } from "../src/lib/public-api-key.ts";
test("web client refuses privileged and malformed keys without echoing them", () => {
  const jwt = (role) =>
    `synthetic.${Buffer.from(JSON.stringify({ role })).toString("base64url")}.synthetic`;
  assert.doesNotThrow(() => assertPublicApiKey("sb_publishable_synthetic"));
  assert.doesNotThrow(() => assertPublicApiKey(jwt("anon")));
  for (const key of [
    jwt("service_role"),
    jwt("authenticated"),
    "sb_secret_" + "synthetic",
    "invalid",
    "",
  ]) {
    assert.throws(
      () => assertPublicApiKey(key),
      (e) => e.message === "Configure somente a chave publicável do Supabase nesta aplicação.",
    );
  }
});
