import { MODEL } from "../_shared/gemini-config.ts";
import { handleRequest } from "../_shared/worker-handler.ts";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";
import { probeGemini, availableGeminiModels } from "../_shared/ai.ts";
Deno.serve(async (req) => {
  if (req.method !== "POST" && req.method !== "OPTIONS")
    return new Response(null, { status: 405, headers: { Allow: "POST, OPTIONS" } });
  // Internal fixed synthetic probe. Its input never accepts resumes or prompts.
  const token = req.headers.get("x-ceny-queue-token");
  if (token) {
    if (req.method !== "POST" || !/^[a-f0-9]{64}$/.test(token))
      return new Response(null, { status: 401 });
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );
    const { data, error } = await admin.rpc("verify_resume_dispatch", { p_token: token });
    if (error || !data) return new Response(null, { status: 401 });
    try {
      const r = await probeGemini();
      return Response.json(r, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      return Response.json(
        {
          ok: false,
          requested_model: MODEL,
          availableModels: await availableGeminiModels(),
          code: error instanceof Error && "status" in error ? error.status : 503,
        },
        { status: 503 },
      );
    }
  }
  return handleRequest(req);
});
