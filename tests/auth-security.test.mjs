import test from "node:test";
import assert from "node:assert/strict";
import { passwordError, completeAuthRedirect, signOutVerified } from "../src/lib/auth-security.ts";

test("signup and reset share a password policy including UTF-8 byte limit", () => {
  assert.equal(passwordError("Strong!Pass2026", "Strong!Pass2026"), null);
  for (const value of [
    "abc",
    "abcdefghijklmnop",
    "ABCDEFGH123456!",
    "abcdefgh123456!",
    "Abcdefghijklm!",
    "Abcdefghij12345",
    `Ab1!${"é".repeat(35)}`,
  ])
    assert.ok(passwordError(value, value));
  assert.ok(passwordError("Strong!Pass2026", "Different!Pass2026"));
});
test("expired confirmation and recovery links fail even if a session already exists", async () => {
  const auth = {
    setSession() {
      throw new Error("must not accept expired link");
    },
  };
  await assert.rejects(
    completeAuthRedirect(
      auth,
      "https://ceny.test/reset-password#error=access_denied&error_code=otp_expired",
    ),
  );
  await assert.rejects(completeAuthRedirect(auth, "https://ceny.test/auth?error_code=otp_expired"));
});
test("a recovery type marker without credentials grants no recovery state", async () => {
  assert.deepEqual(
    await completeAuthRedirect({}, "https://ceny.test/reset-password#type=recovery"),
    { recovery: false, handled: false },
  );
});
test("incomplete and rejected credentials cannot activate recovery", async () => {
  await assert.rejects(completeAuthRedirect({}, "https://ceny.test/#access_token=x&type=recovery"));
  await assert.rejects(
    completeAuthRedirect(
      { setSession: async () => ({ error: new Error(), data: {} }) },
      "https://ceny.test/#access_token=x&refresh_token=y&type=recovery",
    ),
  );
});
test("valid recovery requires server verified identity", async () => {
  const auth = {
    setSession: async () => ({ data: { session: { user: { id: "a" } } }, error: null }),
    getUser: async () => ({ data: { user: { id: "a" } }, error: null }),
  };
  assert.deepEqual(
    await completeAuthRedirect(
      auth,
      "https://ceny.test/#access_token=x&refresh_token=y&type=recovery",
    ),
    { recovery: true, handled: true },
  );
  assert.deepEqual(
    await completeAuthRedirect(
      auth,
      "https://ceny.test/#access_token=x&refresh_token=y&type=signup",
    ),
    { recovery: false, handled: true },
  );
  auth.getUser = async () => ({ data: { user: { id: "b" } }, error: null });
  await assert.rejects(
    completeAuthRedirect(auth, "https://ceny.test/#access_token=x&refresh_token=y&type=recovery"),
  );
});
test("logout verifies global revocation response and absence of local session", async () => {
  let scope;
  await signOutVerified({
    signOut: async (arg) => {
      scope = arg.scope;
      return { error: null };
    },
    getSession: async () => ({ data: { session: null }, error: null }),
  });
  assert.equal(scope, "global");
  await assert.rejects(signOutVerified({ signOut: async () => ({ error: new Error("offline") }) }));
  await assert.rejects(
    signOutVerified({
      signOut: async () => ({ error: null }),
      getSession: async () => ({ data: { session: {} }, error: null }),
    }),
  );
});
