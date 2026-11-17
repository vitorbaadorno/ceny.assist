// Negative probes only. No valid user, scheduler or privileged credential is sent.
import fs from "node:fs";
try {
  const config = Object.fromEntries(
    fs
      .readFileSync(".env.example", "utf8")
      .split(/\r?\n/)
      .filter((line) => /^[A-Z_]+=/.test(line))
      .map((line) => {
        const at = line.indexOf("=");
        return [line.slice(0, at), line.slice(at + 1)];
      }),
  );
  const base = new URL(config.VITE_SUPABASE_URL);
  if (base.protocol !== "https:" || base.hostname !== "wikerxujjvmoksrmjywo.supabase.co")
    throw new Error();
  const tests = [
    {
      name: "analisar-curriculo:method-denied",
      path: "/functions/v1/analisar-curriculo",
      headers: {},
      method: "GET",
      expected: [405],
    },
    {
      name: "analisar-curriculo:malformed-scheduler",
      path: "/functions/v1/analisar-curriculo",
      headers: { "x-ceny-queue-token": "synthetic-invalid" },
      method: "POST",
    },
    ...["ceny-worker", "analisar-curriculo", "ceny-queue"].map((name) => ({
      name: `${name}:missing-auth`,
      path: `/functions/v1/${name}`,
      headers: {},
      method: "POST",
    })),
    ...["ceny-worker", "analisar-curriculo"].map((name) => ({
      name: `${name}:invalid-auth`,
      path: `/functions/v1/${name}`,
      headers: { Authorization: "Bearer invalid-synthetic-token" },
      method: "POST",
    })),
    {
      name: "ceny-queue:forged-token",
      path: "/functions/v1/ceny-queue",
      headers: { "x-ceny-queue-token": "0".repeat(64) },
      method: "POST",
    },
    {
      name: "candidates:anonymous",
      path: "/rest/v1/candidates?select=id&limit=1",
      headers: {},
      method: "GET",
    },
  ];
  const results = [];
  for (const check of tests) {
    const response = await fetch(new URL(check.path, base), {
      method: check.method,
      headers: { apikey: config.VITE_SUPABASE_PUBLISHABLE_KEY, ...check.headers },
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
    await response.body?.cancel();
    results.push({
      name: check.name,
      status: response.status,
      passed: (check.expected ?? [401, 403]).includes(response.status),
    });
  }
  fs.mkdirSync("artifacts", { recursive: true });
  fs.writeFileSync(
    "artifacts/public-endpoints.json",
    JSON.stringify({ checked_at: new Date().toISOString(), results }, null, 2),
  );
  console.log(JSON.stringify(results));
  if (results.some((result) => !result.passed)) process.exitCode = 1;
} catch {
  console.error("Endpoints hospedados não validados; falha de conexão ou configuração.");
  process.exitCode = 1;
}
