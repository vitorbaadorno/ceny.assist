// Infrastructure-only utility. Never put the signing key or service key in browser envs.
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { signLedger, verifyLedger } from "./privacy-ledger.mjs";
const [mode, file] = process.argv.slice(2);
if (!["export-ledger", "reconcile-restored"].includes(mode) || !file)
  throw new Error(
    "Uso: node scripts/privacy-recovery.mjs export-ledger|reconcile-restored arquivo.json",
  );
const url = process.env.SUPABASE_URL,
  key = process.env.SUPABASE_SERVICE_ROLE_KEY,
  signing = process.env.CENY_RECOVERY_SIGNING_KEY;
const source = process.env.CENY_RECOVERY_SOURCE_PROJECT;
if (!url || !key || !source)
  throw new Error("Configure o destino, a credencial de serviço e a origem esperada.");
const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
if (mode === "export-ledger") {
  const { data, error } = await admin.rpc("export_privacy_ledger");
  if (error) throw new Error("Falha ao exportar manifesto.");
  fs.writeFileSync(file, JSON.stringify(signLedger({ ...data, project: source }, signing)), {
    flag: "wx",
    mode: 0o600,
  });
  console.log(
    "Manifesto assinado exportado. Guarde-o fora do projeto e do conjunto de backups, com controle de acesso.",
  );
} else {
  if (process.env.CENY_RESTORE_ISOLATED !== "confirmed")
    throw new Error(
      "Isole rede, aplicação, Storage e workers antes da reconciliação. Confirme CENY_RESTORE_ISOLATED=confirmed somente após fazê-lo.",
    );
  const ledger = verifyLedger(JSON.parse(fs.readFileSync(file, "utf8")), signing, source);
  // Quarantine every company in the restored DB, including ones absent from old journal.
  let offset = 0,
    companies = [];
  for (;;) {
    const { data, error } = await admin
      .from("companies")
      .select("id")
      .order("id")
      .range(offset, offset + 499);
    if (error) throw new Error("Falha ao conferir empresas restauradas.");
    companies.push(...data);
    if (data.length < 500) break;
    offset += 500;
  }
  for (const { id } of companies) {
    const erased = [
      ...new Set(
        ledger.erasures.filter((e) => e.company_id === id).flatMap((e) => e.candidate_ids),
      ),
    ];
    if (erased.length > 10000)
      throw new Error(
        "Empresa excede o limite de reconciliação; mantenha a quarentena e solicite operação assistida.",
      );
    const { error } = await admin.rpc("reconcile_privacy_restore_objects", {
      p_company: id,
      p_erased: erased,
      p_objects: [
        ...new Set(
          ledger.erasures.filter((e) => e.company_id === id).flatMap((e) => e.objects ?? []),
        ),
      ],
    });
    if (error)
      throw new Error(
        "Reconciliação incompleta. Mantenha o ambiente isolado e repita após corrigir a falha.",
      );
  }
  console.log(
    "Acessos antigos retirados e eliminações reenfileiradas. NÃO reabra o ambiente: conclua arquivos, confira o manifesto mais recente e aprove novos acessos conforme o procedimento.",
  );
}
