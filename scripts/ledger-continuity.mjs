export function assertLedgerFresh(ledger, now = Date.now(), maxAgeMinutes = 15) {
  const at = Date.parse(ledger.exported_at);
  if (!Number.isFinite(at) || at > now + 60000 || now - at > maxAgeMinutes * 60000)
    throw new Error("Manifesto ausente, futuro ou desatualizado; mantenha a recuperação isolada.");
}
export function assertLedgerContinuity(previous, next) {
  if (previous.project !== next.project || Date.parse(next.exported_at) < Date.parse(previous.exported_at))
    throw new Error("Origem ou sequência do manifesto inválida.");
  const facts = ledger => new Set([
    ...ledger.companies.map(id => `company:${id}`),
    ...ledger.erasures.flatMap(e => [...e.candidate_ids.map(id => `erased:${e.company_id}:${id}`), ...e.objects.map(p => `object:${e.company_id}:${p}`)]),
  ]);
  const current = facts(next);
  if ([...facts(previous)].some(fact => !current.has(fact)))
    throw new Error("Manifesto perdeu registros; não substituir a evidência anterior.");
}
