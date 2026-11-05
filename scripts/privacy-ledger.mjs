import { createHmac, timingSafeEqual } from "node:crypto";

export function signLedger(ledger, key) {
  if (!key || key.length < 32)
    throw new Error("Use uma chave independente com pelo menos 32 caracteres.");
  const payload = JSON.stringify(ledger);
  return { payload, signature: createHmac("sha256", key).update(payload).digest("hex") };
}
export function verifyLedger(envelope, key, expectedProject) {
  if (typeof envelope.payload !== "string" || !/^[a-f0-9]{64}$/.test(envelope.signature ?? ""))
    throw new Error("Manifesto inválido.");
  const expected = signLedger(JSON.parse(envelope.payload), key).signature;
  if (!timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(envelope.signature, "hex")))
    throw new Error("Assinatura inválida.");
  const ledger = JSON.parse(envelope.payload);
  if (
    ledger.project !== expectedProject ||
    ledger.version !== 1 ||
    !Array.isArray(ledger.erasures) ||
    !Array.isArray(ledger.companies)
  )
    throw new Error("Origem ou versão incompatível.");
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (
    !ledger.companies.every((id) => uuid.test(id)) ||
    !ledger.erasures.every(
      (e) =>
        uuid.test(e.company_id) &&
        Array.isArray(e.candidate_ids) &&
        e.candidate_ids.every((id) => uuid.test(id)) &&
        Array.isArray(e.objects) &&
        e.objects.every((p) => typeof p === "string"),
    )
  )
    throw new Error("Identificadores inválidos.");
  return ledger;
}
