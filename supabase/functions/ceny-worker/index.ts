import { createClient } from 'npm:@supabase/supabase-js@2.116.0';
import { z } from 'npm:zod@3.25.76';
import type { Database } from '../_shared/database.ts';
import { rankCandidates } from '../_shared/ranking.ts';
import { processResume } from '../_shared/resumes.ts';

const input = z.discriminatedUnion('action', [
  z.object({ action: z.literal('rank'), companyId: z.string().uuid(), jobId: z.string().uuid() }).strict(),
  z.object({ action: z.literal('extract'), companyId: z.string().uuid(), candidateId: z.string().uuid() }).strict(),
]);
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return json({ error: 'Método inválido.' }, 405);
  const authorization = req.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return json({ error: 'Autenticação necessária.' }, 401);
  const url = Deno.env.get('SUPABASE_URL')!;
  const supabase = createClient<Database>(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: auth, error } = await supabase.auth.getUser(authorization.slice(7));
  if (error || !auth.user || auth.user.is_anonymous) return json({ error: 'Sessão inválida.' }, 401);
  let body: z.infer<typeof input>;
  try { body = input.parse(await req.json()); } catch { return json({ error: 'Solicitação inválida.' }, 400); }
  const admin = createClient<Database>(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const context = { supabase, admin, userId: auth.user.id };
  try {
    return json(body.action === 'rank' ? await rankCandidates(body, context) : await processResume(body, context));
  } catch {
    // Never send provider responses, resume content or DB internals to a caller.
    return json({ error: 'Operação indisponível. Confira seu acesso e a configuração do serviço.' }, 403);
  }
});
