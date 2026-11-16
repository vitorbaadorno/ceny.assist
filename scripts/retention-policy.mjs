// Uses the existing authorized erasure saga; never deletes rows or Storage directly.
const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
export function validateRetentionPolicy(policy) {
  if (!policy || policy.version !== 1 || !uuid.test(policy.company_id ?? "") ||
      typeof policy.approval_reference !== "string" || policy.approval_reference.trim().length < 10 ||
      typeof policy.approved_by !== "string" || !policy.approved_by.trim() ||
      !Number.isInteger(policy.candidate_days) || policy.candidate_days < 1 || policy.candidate_days > 36500 ||
      !Number.isFinite(Date.parse(policy.approved_at)) ||
      !Number.isFinite(Date.parse(policy.review_at)) ||
      policy.basis !== "candidate_created_at")
    throw new Error("Política de retenção ausente, incompleta ou não aprovada.");
  return policy;
}

export async function runRetention(client, input, { execute = false, now = new Date() } = {}) {
  const policy = validateRetentionPolicy(input);
  if (Date.parse(policy.approved_at) > +now || Date.parse(policy.review_at) <= +now)
    throw new Error("A política exige aprovação ou revisão vigente.");
  const cutoff = +now - policy.candidate_days * 86400000;
  const candidates = new Map();
  for (let offset = 0; ; offset += 50) {
    const { data, error } = await client.rpc("privacy_candidates", {
      p_company: policy.company_id, p_offset: offset,
    });
    if (error || !Array.isArray(data)) throw new Error("Não foi possível conferir o acervo autorizado.");
    for (const row of data.slice(0, 50)) candidates.set(row.id, { id: row.id, created_at: row.created_at });
    // The existing RPC returns 50 records plus one look-ahead record.
    if (data.length <= 50) break;
    if (offset >= 100000) throw new Error("Acervo excede o limite desta execução; operação assistida necessária.");
  }
  const handled = new Set();
  const summary = { mode: execute ? "execute" : "dry-run", eligible: 0, held: 0, mixed_scope: 0, queued: 0 };
  for (const row of candidates.values()) {
    if (handled.has(row.id) || !Number.isFinite(Date.parse(row.created_at)) || Date.parse(row.created_at) > cutoff) continue;
    const { data: preview, error } = await client.rpc("preview_candidate_erasure", {
      p_company: policy.company_id, p_candidate: row.id,
    });
    if (error || !preview || !Array.isArray(preview.candidate_ids) || !preview.candidate_ids.length ||
        !Number.isInteger(preview.holds) || preview.holds < 0)
      throw new Error("Prévia de eliminação indisponível; execução interrompida.");
    for (const id of preview.candidate_ids) handled.add(id);
    if (preview.holds > 0) { summary.held++; continue; }
    // A recent merged identity must never be erased just because its source is old.
    if (!preview.candidate_ids.every((id) => {
      const created = Date.parse(candidates.get(id)?.created_at);
      return Number.isFinite(created) && created <= cutoff;
    })) { summary.mixed_scope++; continue; }
    summary.eligible++;
    if (execute) {
      const { data, error: requestError } = await client.rpc("request_candidate_erasure", {
        p_company: policy.company_id, p_candidate: row.id,
        p_confirmed_ids: preview.candidate_ids,
        p_reason: `Retenção aprovada: ${policy.approval_reference}`.slice(0, 500),
        p_request: crypto.randomUUID(),
      });
      if (requestError || !data) throw new Error("Eliminação não confirmada. Confira as operações antes de repetir.");
      summary.queued++;
    }
  }
  return summary; // Never log candidate names, IDs or approval text.
}
