// Infrastructure utility. Requires a quiesced source and a protected external mount.
import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { recoveryKey, encryptRecovery, decryptRecovery } from "./recovery-crypto.mjs";
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
try {
  const directory = path.resolve(process.env.CENY_BACKUP_DIRECTORY ?? "");
  const relative = path.relative(process.cwd(), directory);
  if (!process.env.CENY_BACKUP_DIRECTORY || (!relative.startsWith("..") && !path.isAbsolute(relative))) throw new Error();
  if (process.env.CENY_BACKUP_WRITES_QUIESCED !== "confirmed") throw new Error();
  const key = recoveryKey(process.env.CENY_BACKUP_ENCRYPTION_KEY);
  const url = new URL(process.env.SUPABASE_URL);
  if (url.protocol !== "https:" || !process.env.PGHOST || !process.env.PGUSER || !process.env.PGDATABASE || process.env.PGSSLMODE !== "verify-full") throw new Error();
  const admin = createClient(url.href, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (url, init) => fetch(url, { ...init, redirect: "error", signal: AbortSignal.timeout(60000) }) },
  });
  const root = path.join(directory, `snapshot-${Date.now()}-${randomUUID()}`);
  await fs.mkdir(root, { recursive: true, mode: 0o700 });
  const manifest = { version: 1, source: url.hostname, created_at: new Date().toISOString(), files: [] };
  async function save(bytes, metadata) {
    const file = `${randomUUID()}.enc`;
    await fs.writeFile(path.join(root, file), encryptRecovery(bytes, key), { flag: "wx", mode: 0o600 });
    const restored = decryptRecovery(await fs.readFile(path.join(root, file)), key);
    if (digest(restored) !== digest(bytes)) throw new Error();
    manifest.files.push({ file, bytes: bytes.length, sha256: digest(bytes), ...metadata });
  }
  // Password stays in PG environment/pgpass, never argv. stderr is discarded on failure.
  const database = execFileSync("pg_dump", ["--format=custom", "--no-owner", "--no-acl"], {
    maxBuffer: 512 * 1024 * 1024, timeout: 900000, stdio: ["ignore", "pipe", "pipe"],
  });
  if (!database.length) throw new Error();
  await save(database, { kind: "database" });
  const { data: buckets, error } = await admin.storage.listBuckets();
  if (error || !Array.isArray(buckets)) throw new Error();
  async function walk(bucket, prefix = "", depth = 0) {
    if (depth > 20) throw new Error();
    for (let offset = 0; ; offset += 100) {
      const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: 100, offset, sortBy: { column: "name", order: "asc" } });
      if (error || !Array.isArray(data)) throw new Error();
      for (const item of data) {
        const object = prefix ? `${prefix}/${item.name}` : item.name;
        if (item.id == null) { await walk(bucket, object, depth + 1); continue; }
        if (Number(item.metadata?.size) > 50 * 1024 * 1024) throw new Error();
        const result = await admin.storage.from(bucket).download(object);
        if (result.error || !result.data || result.data.size > 50 * 1024 * 1024) throw new Error();
        await save(Buffer.from(await result.data.arrayBuffer()), { kind: "storage", bucket, object, content_type: result.data.type });
      }
      if (data.length < 100) break;
    }
  }
  for (const bucket of buckets) await walk(bucket.id);
  // The manifest is committed last. Its absence means the snapshot is incomplete.
  await fs.writeFile(path.join(root, "manifest.enc"), encryptRecovery(Buffer.from(JSON.stringify(manifest)), key), { flag: "wx", mode: 0o600 });
  console.log(JSON.stringify({ completed: true, files: manifest.files.length, bytes: manifest.files.reduce((n, f) => n + f.bytes, 0) }));
} catch {
  console.error("Backup não confirmado. Mantenha a cópia anterior; verifique o executor, a cifragem, a pausa de gravações e os acessos.");
  process.exitCode = 1;
}
