import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { apprenticeAgeMessages, type ApprenticeAgeAssessment } from "@/lib/age";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";

export function ApprenticeAgeNotice({
  assessment,
}: {
  assessment?: ApprenticeAgeAssessment | undefined;
}) {
  return (
    <div className="space-y-2 rounded border border-amber-300 bg-amber-50/50 p-3 text-sm dark:bg-amber-950/20">
      <p className="font-medium">Aprendizagem · conferência jurídica pendente</p>
      {assessment ? (
        <>
          <p>{apprenticeAgeMessages[assessment.state]}</p>
          <p>
            Referência: {assessment.reference_date.split("-").reverse().join("/")} · data da análise
            em São Paulo.
            {assessment.age !== null
              ? ` Idade nessa referência: ${assessment.age} anos.`
              : " Idade não confirmada."}
          </p>
        </>
      ) : (
        <p>
          Esta avaliação anterior não registrou a conferência etária. Calcule novamente para
          registrá-la.
        </p>
      )}
      <p>
        Faixa geral: 14 anos completos a menos de 24. Exceções exigem conferência humana autorizada.
        A idade não altera a nota de aderência nem remove candidatos.
      </p>
      <p>
        Referência preliminar: confirme novamente as condições e a data aplicável antes da
        contratação. Nenhuma deficiência ou condição sensível é presumida pelo sistema.
      </p>
      <a
        className="underline"
        href="https://www.planalto.gov.br/ccivil_03/decreto-lei/del5452compilado.htm"
        target="_blank"
        rel="noreferrer"
      >
        Base de consulta: CLT, arts. 403, 428 e 433
      </a>
    </div>
  );
}

export function ApprenticeCaseReview({
  companyId,
  runId,
  candidateId,
  outdated,
}: {
  companyId: string;
  runId: string;
  candidateId: string;
  outdated: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-3 text-sm">
      <Button variant="outline" size="sm" onClick={() => setOpen(!open)}>
        {open ? "Fechar conferência especial" : "Conferência especial · administradores"}
      </Button>
      {open && (
        <CaseForm
          companyId={companyId}
          runId={runId}
          candidateId={candidateId}
          outdated={outdated}
        />
      )}
    </div>
  );
}
function CaseForm({
  companyId,
  runId,
  candidateId,
  outdated,
}: {
  companyId: string;
  runId: string;
  candidateId: string;
  outdated: boolean;
}) {
  const cache = useQueryClient();
  const [status, setStatus] = useState("pending_legal");
  const [reason, setReason] = useState("");
  const [legalName, setLegalName] = useState("");
  const [reference, setReference] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [page, setPage] = useState(0);
  const [request, setRequest] = useState(() => crypto.randomUUID());
  const key = ["apprentice-reviews", companyId, runId, candidateId];
  const history = useQuery({
    queryKey: [...key, page],
    refetchInterval: 5000,
    queryFn: async () => {
      const r = await supabase
        .from("apprentice_case_reviews")
        .select("*")
        .eq("company_id", companyId)
        .eq("run_id", runId)
        .eq("candidate_id", candidateId)
        .order("version", { ascending: false })
        .range(page * 10, page * 10 + 9);
      if (r.error) throw r.error;
      return r.data;
    },
  });
  // Latest version is queried independently of the history page.
  const latest = useQuery({
    queryKey: [...key, "latest"],
    refetchInterval: 5000,
    queryFn: async () => {
      const r = await supabase
        .from("apprentice_case_reviews")
        .select("version")
        .eq("company_id", companyId)
        .eq("run_id", runId)
        .eq("candidate_id", candidateId)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (r.error) throw r.error;
      return r.data?.version ?? 0;
    },
  });
  const save = useMutation({
    mutationFn: async () => {
      const r = await supabase.rpc("record_apprentice_review", {
        p_company: companyId,
        p_run: runId,
        p_candidate: candidateId,
        p_request: request,
        p_expected_version: latest.data ?? 0,
        p_status: status,
        p_justification: reason,
        p_legal_responsible: legalName,
        p_legal_reference: reference,
        p_confirmed: confirmed,
      });
      if (r.error) throw r.error;
    },
    onSuccess: () => {
      cache.invalidateQueries({ queryKey: key });
      setReason("");
      setConfirmed(false);
      setRequest(crypto.randomUUID());
    },
  });
  const disabled =
    outdated || latest.isLoading || latest.isError || history.isError || save.isPending;
  function edited() {
    setRequest(crypto.randomUUID());
    save.reset();
  }
  return (
    <div className="space-y-3 rounded border p-4">
      <p>
        Justificativa e parecer ficam restritos a administradores da empresa. Registre o
        procedimento e a referência do documento; não copie diagnósticos, laudos ou informações
        médicas aqui.
      </p>
      {outdated && (
        <p role="alert">
          A avaliação está desatualizada. Recalcule antes de registrar nova conferência.
        </p>
      )}
      <Label className="block">
        Situação
        <select
          className="mt-1 w-full rounded border bg-background p-2"
          value={status}
          disabled={disabled}
          onChange={(e) => {
            setStatus(e.target.value);
            edited();
          }}
        >
          <option value="pending_legal">Aguardando parecer jurídico</option>
          <option value="legal_recorded">Parecer jurídico recebido e registrado</option>
        </select>
      </Label>
      <Label className="block">
        Justificativa da conferência
        <Textarea
          value={reason}
          maxLength={1000}
          disabled={disabled}
          onChange={(e) => {
            setReason(e.target.value);
            edited();
          }}
          placeholder="Descreva o que precisa ser conferido e o encaminhamento adotado (mínimo 20 caracteres)."
        />
      </Label>
      <Label className="block">
        Responsável jurídico
        <Input
          value={legalName}
          maxLength={160}
          disabled={disabled}
          onChange={(e) => {
            setLegalName(e.target.value);
            edited();
          }}
          placeholder="Obrigatório somente ao registrar parecer recebido"
        />
      </Label>
      <Label className="block">
        Referência do parecer
        <Input
          value={reference}
          maxLength={300}
          disabled={disabled}
          onChange={(e) => {
            setReference(e.target.value);
            edited();
          }}
          placeholder="Protocolo ou referência interna; sem conteúdo médico"
        />
      </Label>
      <label className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={confirmed}
          disabled={disabled}
          onChange={(e) => {
            setConfirmed(e.target.checked);
            edited();
          }}
        />
        <span>
          Conferi o registro. Ele não equivale a uma decisão automática de elegibilidade ou
          contratação.
        </span>
      </label>
      <Button
        disabled={
          disabled ||
          !confirmed ||
          reason.trim().length < 20 ||
          (status === "legal_recorded" &&
            (legalName.trim().length < 3 || reference.trim().length < 5))
        }
        onClick={() => save.mutate()}
      >
        {save.isPending ? "Salvando…" : "Registrar conferência"}
      </Button>
      {save.isSuccess && <p role="status">Conferência registrada no histórico.</p>}
      {(save.isError || history.isError || latest.isError) && (
        <p role="alert">
          Não foi possível confirmar o registro. Confira seu acesso e atualize os dados; outra
          pessoa pode ter registrado uma conferência. Repetir sem alterar os campos não duplica o
          registro.
        </p>
      )}
      <h3 className="font-medium">Histórico de conferências</h3>
      {history.data?.length === 0 && <p>Nenhuma conferência registrada.</p>}
      {history.data?.map((r) => (
        <article key={r.id} className="space-y-1 border-t pt-3">
          <p>
            {new Date(r.created_at).toLocaleString("pt-BR")} ·{" "}
            {r.actor_name || "Administrador registrado"} · Revisão {r.version}
          </p>
          <p>
            {r.status === "pending_legal"
              ? "Aguardando parecer jurídico"
              : "Parecer recebido e registrado; decisão continua humana"}
          </p>
          <p className="whitespace-pre-wrap">{r.justification}</p>
          {r.legal_responsible && <p>Responsável jurídico: {r.legal_responsible}</p>}
          {r.legal_reference && <p>Referência: {r.legal_reference}</p>}
          <p>Data de referência etária: {r.reference_date.split("-").reverse().join("/")}.</p>
        </article>
      ))}
      {(page > 0 || history.data?.length === 10) && (
        <div className="flex gap-3">
          <Button variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>
            Anterior
          </Button>
          <Button
            variant="outline"
            disabled={history.data?.length !== 10}
            onClick={() => setPage(page + 1)}
          >
            Próxima
          </Button>
        </div>
      )}
    </div>
  );
}
