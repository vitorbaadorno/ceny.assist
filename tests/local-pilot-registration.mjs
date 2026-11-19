import { execFileSync } from "node:child_process";

// Fixture setup, never a production provisioning tool. Bound to localhost and reserved email.
export function allowSyntheticRegistration(config, email) {
  const db = config.DB_URL || "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
  if (
    !["localhost", "127.0.0.1"].includes(new URL(db).hostname) ||
    !/^[a-zA-Z0-9.+_-]+@(?:test|example)\.invalid$/.test(email)
  )
    throw Error("Local synthetic fixture required");
  execFileSync(
    "psql",
    [
      db,
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      `insert into private.pilot_registrations(email,approval_reference,expires_at) values('${email.toLowerCase()}','synthetic-fixture',now()+interval '1 hour') on conflict(email) do update set expires_at=excluded.expires_at,revoked_at=null`,
    ],
    { stdio: "pipe" },
  );
}
