import { createClient } from "npm:@supabase/supabase-js@2.116.0";
import type { Database } from "../_shared/database.ts";
import { runResumeQueue } from "../_shared/queue.ts";
Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Método inválido", { status: 405 });
  const token = req.headers.get("x-ceny-queue-token");
  if (!token || !/^[a-f0-9]{64}$/.test(token))
    return new Response("Não autorizado", { status: 401 });
  const admin = createClient<Database>(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) =>
          fetch(input, {
            ...init,
            signal: init?.signal
              ? AbortSignal.any([init.signal, AbortSignal.timeout(30000)])
              : AbortSignal.timeout(30000),
          }),
      },
    },
  );
  const { data: valid, error } = await admin.rpc("verify_resume_dispatch", { p_token: token });
  if (error || !valid) return new Response("Não autorizado", { status: 401 });
  try {
    const jobs = await runResumeQueue(admin);
    return Response.json({ processed: jobs.length }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Fila temporariamente indisponível." }, { status: 503 });
  }
});
