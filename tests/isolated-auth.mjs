// Only talks to disposable localhost Supabase. No production keys or email delivery.
import fs from "node:fs";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { completeAuthRedirect, passwordError, signOutVerified } from "../src/lib/auth-security.ts";

const config = JSON.parse(fs.readFileSync("artifacts/local-supabase.json", "utf8"));
const api = config.API_URL;
const mail = config.INBUCKET_URL || "http://127.0.0.1:54324";
const db = config.DB_URL || "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
for (const url of [api, mail, db])
  assert.ok(
    ["127.0.0.1", "localhost"].includes(new URL(url).hostname),
    "This suite may only run on localhost",
  );
const client = () =>
  createClient(api, config.ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
const account = client();
const email = `ceny-${randomUUID()}@test.invalid`;
const password = `Test!${randomUUID()}Aa1`;
const replacement = `New!${randomUUID()}Aa2`;
const results = [];
async function check(name, fn) {
  await fn();
  results.push({ name, passed: true });
  console.log(`PASS ${name}`);
}
async function messageLink(type) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const response = await fetch(`${mail}/api/v1/messages`);
    assert.ok(response.ok, "Mailpit API reachable");
    const inbox = await response.json();
    for (const item of inbox.messages || []) {
      if (!item.To?.some((to) => to.Address === email)) continue;
      const content = await (await fetch(`${mail}/api/v1/message/${item.ID}`)).json();
      const links = (content.HTML || content.Text || "").match(/https?:\/\/[^\s"<>]+/g) || [];
      const link = links
        .map((url) => url.replaceAll("&amp;", "&"))
        .find(
          (url) =>
            url.includes("/auth/v1/verify?") && new URL(url).searchParams.get("type") === type,
        );
      if (link) return link;
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`Test email for ${type} not received`);
}
async function follow(link) {
  assert.ok(["127.0.0.1", "localhost"].includes(new URL(link).hostname));
  const response = await fetch(link, { redirect: "manual" });
  assert.equal(response.status, 303);
  const location = response.headers.get("location");
  assert.ok(location, "Auth redirect present");
  return location;
}
let signupLink;
let recoveryLink;
let userId;
try {
  await check("weak password rejected by Auth service", async () => {
    const { error } = await account.auth.signUp({ email, password: "short" });
    assert.ok(error);
  });
  await check("signup requires email confirmation", async () => {
    assert.equal(passwordError(password, password), null);
    const { data, error } = await account.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: "http://127.0.0.1:8080/auth",
        data: { full_name: "Isolated test" },
      },
    });
    assert.ok(!error, error?.message);
    assert.ok(data.user);
    assert.ok(!data.session);
    userId = data.user.id;
  });
  await check("login before confirmation denied", async () => {
    const { error } = await account.auth.signInWithPassword({ email, password });
    assert.ok(error);
  });
  await check("confirmation email opens a verified session", async () => {
    signupLink = await messageLink("signup");
    const redirect = await follow(signupLink);
    const result = await completeAuthRedirect(account.auth, redirect);
    assert.ok(result.handled && !result.recovery);
    const { data, error } = await account.auth.getUser();
    assert.ok(!error);
    assert.ok(data.user.email_confirmed_at);
  });
  await check("used confirmation link rejected", async () => {
    await assert.rejects(completeAuthRedirect(client().auth, await follow(signupLink)));
  });
  await check("new account starts without company data", async () => {
    const { data, error } = await account.from("companies").select("id");
    assert.ok(!error);
    assert.equal(data.length, 0);
  });
  await check("first access configures company and responsible person", async () => {
    const { data, error } = await account.rpc("create_company", {
      p_name: "Isolated company",
      p_responsible: "Test Responsible",
    });
    assert.ok(!error, error?.message);
    assert.ok(data);
    const result = await account.from("company_members").select("role").eq("company_id", data);
    assert.equal(result.data?.[0]?.role, "owner");
  });
  await check("logout clears session and revokes refresh token", async () => {
    const token = (await account.auth.getSession()).data.session.refresh_token;
    await signOutVerified(account.auth);
    const result = await client().auth.refreshSession({ refresh_token: token });
    assert.ok(result.error);
  });
  await check("confirmed account logs in", async () => {
    const { data, error } = await account.auth.signInWithPassword({ email, password });
    assert.ok(!error);
    assert.ok(data.session);
  });
  await check("incorrect password denied", async () => {
    const result = await client().auth.signInWithPassword({
      email,
      password: "Incorrect!Password1",
    });
    assert.ok(result.error);
  });
  await check("recovery email creates validated recovery flow", async () => {
    const { error } = await account.auth.resetPasswordForEmail(email, {
      redirectTo: "http://127.0.0.1:8080/reset-password",
    });
    assert.ok(!error, error?.message);
    recoveryLink = await messageLink("recovery");
    const redirect = await follow(recoveryLink);
    assert.equal(new URL(redirect).pathname, "/reset-password");
    const result = await completeAuthRedirect(account.auth, redirect);
    assert.ok(result.recovery);
  });
  await check("reset enforces same server password requirements", async () => {
    const { error } = await account.auth.updateUser({ password: "weak" });
    assert.ok(error);
  });
  await check("password reset and verified logout succeed", async () => {
    assert.equal(passwordError(replacement, replacement), null);
    const { error } = await account.auth.updateUser({ password: replacement });
    assert.ok(!error, error?.message);
    await signOutVerified(account.auth);
  });
  await check("old password rejected and new password accepted", async () => {
    assert.ok((await account.auth.signInWithPassword({ email, password })).error);
    assert.ok(!(await account.auth.signInWithPassword({ email, password: replacement })).error);
  });
  await check("used recovery link cannot be replayed", async () => {
    await assert.rejects(completeAuthRedirect(account.auth, await follow(recoveryLink)));
  });
  await new Promise((resolve) => setTimeout(resolve, 1100));
  await check("expired recovery link fails despite a valid existing session", async () => {
    const { error } = await account.auth.resetPasswordForEmail(email, {
      redirectTo: "http://127.0.0.1:8080/reset-password",
    });
    assert.ok(!error, error?.message);
    const link = await messageLink("recovery");
    assert.ok(/^[0-9a-f-]{36}$/.test(userId));
    execFileSync(
      "psql",
      [
        db,
        "-v",
        "ON_ERROR_STOP=1",
        "-c",
        `update auth.users set recovery_sent_at=now()-interval '2 hours' where id='${userId}'`,
      ],
      { stdio: "pipe" },
    );
    await assert.rejects(completeAuthRedirect(account.auth, await follow(link)));
  });
} finally {
  fs.writeFileSync(
    "artifacts/auth-results.json",
    JSON.stringify({ suite: "isolated-auth", passed: results.length, results }, null, 2),
  );
  await account.auth.signOut();
}
