import { createClient } from "npm:@supabase/supabase-js@2.116.0";
import { z } from "npm:zod@4.6.7";
import type { Database } from "./database.ts";
import { rankCandidates } from "./ranking.ts";
import { processResume } from "./resumes.ts";
import { receiveResume, cleanupResumes } from "./intake.ts";
import { readLimitedBody, FileRejected } from "./file-policy.ts";

const input = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("analyze"),
      companyId: z.string().uuid(),
      candidateId: z.string().uuid(),
      jobId: z.string().uuid(),
      requestId: z.string().uuid(),
    })
    .strict(),
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
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info, x-ceny-filename",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

export async function handleRequest(req: Request) {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ error: "MÃƒÂ©todo invÃƒÂ¡lido." }, 405);
  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer "))
    return json({ error: "AutenticaÃƒÂ§ÃƒÂ£o necessÃƒÂ¡ria." }, 401);
  const url = Deno.env.get("SUPABASE_URL")!;
  const supabase = createClient<Database>(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: auth, error } = await supabase.auth.getUser(authorization.slice(7));
  if (error || !auth.user || auth.user.is_anonymous)
    return json({ error: "SessÃƒÂ£o invÃƒÂ¡lida." }, 401);
  const admin = createClient<Database>(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const context = { supabase, admin, userId: auth.user.id };
  const operation = crypto.randomUUID();
  let company: string | undefined;
  let action = "query";
  const admit = async (company: string) => {
    if (!new URL(req.url).pathname.endsWith("/analisar-curriculo")) return true;
    const r = await supabase.rpc("admit_ai_request", { p_company: company });
    return !r.error && r.data === true;
  };
  try {
    const url = new URL(req.url);
    if (url.searchParams.get("action") === "upload") {
      const filename = req.headers.get("x-ceny-filename");
      if (filename) url.searchParams.set("filename", decodeURIComponent(filename));
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
          "Confirme a identidade antes de adicionar uma versÃƒÂ£o.",
        )
        .parse(Object.fromEntries([...url.searchParams].filter(([key]) => key !== "action")));
      company = args.companyId;
      if (!(await admit(company)))
        return json(
          {
            error:
              "Limite de solicitações ou acesso indisponível. Aguarde um minuto e confira sua permissão.",
          },
          429,
        );
      action = "upload";
      return json(await receiveResume(req, args, context));
    }
    const body = input.parse(
      JSON.parse(new TextDecoder().decode(await readLimitedBody(req, 8192))),
    );
    company = body.companyId;
    if (!(await admit(company)))
      return json(
        {
          error:
            "Limite de solicitações ou acesso indisponível. Aguarde um minuto e confira sua permissão.",
        },
        429,
      );
    action = body.action === "extract" ? "reprocess" : body.action === "cleanup" ? "erase" : "rank";
    if (body.action === "analyze") {
      const result = await supabase.rpc("request_vacancy_analysis", {
        p_company: body.companyId,
        p_candidate: body.candidateId,
        p_job: body.jobId,
        p_request: body.requestId,
      });
      if (result.error || !result.data)
        return json(
          {
            error:
              "NÃ£o foi possÃ­vel reservar a anÃ¡lise. Confira as permissÃµes e os limites da empresa.",
          },
          409,
        );
      return json(
        {
          status: "queued",
          jobId: result.data,
          candidateId: body.candidateId,
          vacancyId: body.jobId,
        },
        202,
      );
    }
    return json(
      body.action === "rank"
        ? await rankCandidates(body, context)
        : body.action === "cleanup"
          ? await cleanupResumes(body.companyId, context)
          : await processResume(body, context),
    );
  } catch (error) {
    const code =
      error instanceof FileRejected || error instanceof z.ZodError ? "invalid" : "service";
    if (company) {
      // The user-scoped RPC independently verifies membership before accepting a company.
      await supabase
        .rpc("ops_report_error", {
          p_company: company,
          p_operation: operation,
          p_action: action,
          p_code: code,
        })
        .then(
          () => {},
          () => {},
        );
    }
    console.error({ source: "worker", operation, action, code });
    if (error instanceof FileRejected) return json({ error: error.message }, 422);
    if (error instanceof z.ZodError) return json({ error: "SolicitaÃƒÂ§ÃƒÂ£o invÃƒÂ¡lida." }, 400);
    // Never send provider responses, resume content or DB internals to a caller.
    return json(
      {
        error:
          "OperaÃƒÂ§ÃƒÂ£o indisponÃƒÂ­vel. Confira seu acesso e a configuraÃƒÂ§ÃƒÂ£o do serviÃƒÂ§o.",
      },
      403,
    );
  }
}
