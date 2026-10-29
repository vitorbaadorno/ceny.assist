import { createClient } from "npm:@supabase/supabase-js@2.116.0";
import { z } from "npm:zod@3.25.76";
import type { Database } from "../_shared/database.ts";
import { rankCandidates } from "../_shared/ranking.ts";
import { processResume } from "../_shared/resumes.ts";
import { receiveResume, cleanupResumes } from "../_shared/intake.ts";
import { readLimitedBody, FileRejected } from "../_shared/file-policy.ts";

const input = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("rank"),
      companyId: z.string().uuid(),
      jobId: z.string().uuid(),
      requestId: z.string().uuid(),
    })
    .strict(),
  z
    .object({
      action: z.literal("extract"),
      companyId: z.string().uuid(),
      candidateId: z.string().uuid(),
    })
    .strict(),
  z.object({ action: z.literal("cleanup"), companyId: z.string().uuid() }).strict(),
]);
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ error: "Método inválido." }, 405);
  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer "))
    return json({ error: "Autenticação necessária." }, 401);
  const url = Deno.env.get("SUPABASE_URL")!;
  const supabase = createClient<Database>(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: auth, error } = await supabase.auth.getUser(authorization.slice(7));
  if (error || !auth.user || auth.user.is_anonymous)
    return json({ error: "Sessão inválida." }, 401);
  const admin = createClient<Database>(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const context = { supabase, admin, userId: auth.user.id };
  try {
    const url = new URL(req.url);
    if (url.searchParams.get("action") === "upload") {
      const args = z
        .object({
          companyId: z.string().uuid(),
          batchId: z.string().uuid(),
          slot: z.coerce.number().int().min(0).max(4),
          filename: z.string().min(1).max(180),
          candidateId: z.string().uuid().optional(),
          identityConfirmed: z.literal("true").optional(),
        })
        .refine(
          (args) => !args.candidateId || args.identityConfirmed === "true",
          "Confirme a identidade antes de adicionar uma versão.",
        )
        .parse(Object.fromEntries([...url.searchParams].filter(([key]) => key !== "action")));
      return json(await receiveResume(req, args, context));
    }
    const body = input.parse(
      JSON.parse(new TextDecoder().decode(await readLimitedBody(req, 8192))),
    );
    return json(
      body.action === "rank"
        ? await rankCandidates(body, context)
        : body.action === "cleanup"
          ? await cleanupResumes(body.companyId, context)
          : await processResume(body, context),
    );
  } catch (error) {
    if (error instanceof FileRejected) return json({ error: error.message }, 422);
    if (error instanceof z.ZodError) return json({ error: "Solicitação inválida." }, 400);
    // Never send provider responses, resume content or DB internals to a caller.
    return json(
      { error: "Operação indisponível. Confira seu acesso e a configuração do serviço." },
      403,
    );
  }
});
