import { useState, type FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LoadingState, QueryError } from "./query-feedback";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { toast } from "sonner";
import { errorFeedback, displayDate } from "@/lib/ui-feedback";

type Policy = {
  version: number;
  upload: number | null;
  analysis: number | null;
  warn: number;
  activity_days: number;
  error_days: number;
};
type Quota = Pick<Policy, "upload" | "analysis" | "warn"> & {
  uploads_used: number;
  analyses_used: number;
};
type Attempt = {
  attempt: number;
  usd: number | null;
  finished: boolean;
  tokens: number | null;
  duration_ms: number | null;
};
type Cost = {
  job_id: string;
  generation: number;
  queued_at: string;
  ai_usd: number | null;
  storage_usd: number | null;
  total_usd: number | null;
  items: Attempt[];
};
type Dashboard = {
  policy: Policy;
  closed: boolean;
  storage_bill: number | null;
  storage_unallocated_usd: number | null;
  admissions: number;
  received: number;
  rejected: number;
  analyses: number;
  completed: number;
  review: number;
  attempts: number;
  failures: number;
  duration_ms: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  unknown_tokens: number;
  byte_hours: number;
  rows: Cost[];
};
type Event = {
  id: string;
  at: string;
  actor_id: string | null;
  actor_name: string | null;
  action: string;
  source: string;
  operation_id: string;
  code: string | null;
};
const usd = (n: number | null) =>
  n === null
    ? "A conciliar"
    : n.toLocaleString("pt-BR", { style: "currency", currency: "USD", maximumFractionDigits: 8 });
const today = () => new Date().toISOString().slice(0, 7);
const number = (n: number | null) =>
  n === null ? "Sem medição" : n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

export function UsageAlert({ companyId }: { companyId: string }) {
  const usage = useQuery({
    queryKey: ["company-usage", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("ops_quota_status", { p_company: companyId });
      if (error) throw error;
      return data as Quota;
    },
    refetchInterval: 60000,
  });
  if (!usage.data || usage.error) return null;
  const { uploads_used, analyses_used, upload, analysis, warn } = usage.data;
  const quotas = [
    { name: "envios", used: uploads_used, limit: upload },
    { name: "análises", used: analyses_used, limit: analysis },
  ];
  const alerts = quotas.filter((q) => q.limit !== null && q.used * 100 >= q.limit * warn);
  return alerts.length ? (
    <aside role="status" className="mb-4 rounded-lg border border-amber-500 p-3 text-sm">
      {alerts.map((q) => (
        <p key={q.name}>
          <strong>{q.used >= q.limit! ? "Limite atingido" : "Próximo do limite"}</strong> · {q.used}{" "}
          de {q.limit} {q.name} neste mês (UTC).
        </p>
      ))}
    </aside>
  ) : null;
}

function PageButtons({
  page,
  more,
  change,
}: {
  page: number;
  more: boolean;
  change: (p: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <Button type="button" variant="outline" disabled={!page} onClick={() => change(page - 1)}>
        Anterior
      </Button>
      <span>Página {page + 1}</span>
      <Button type="button" variant="outline" disabled={!more} onClick={() => change(page + 1)}>
        Próxima
      </Button>
    </div>
  );
}

function Limits({
  policy,
  companyId,
  refresh,
}: {
  policy: Policy;
  companyId: string;
  refresh: () => Promise<void>;
}) {
  const save = useMutation({
    mutationFn: async (form: FormData) => {
      const field = (key: string) => (form.get(key) === "" ? null : Number(form.get(key)));
      const { data, error } = await supabase.rpc("ops_configure", {
        p_company: companyId,
        p_version: policy.version,
        p_upload: field("upload"),
        p_analysis: field("analysis"),
        p_warn: field("warn")!,
        p_activity_days: field("activity_days")!,
        p_error_days: field("error_days")!,
      });
      if (error) throw error;
      if (data !== policy.version + 1) throw new Error();
    },
    onSuccess: async () => {
      await refresh();
      toast.success("Configurações salvas.");
    },
    onError: async (e) => {
      toast.error(errorFeedback(e).message);
      if (errorFeedback(e).kind === "conflict") await refresh();
    },
  });
  const fields = [
    ["upload", "Envios por mês", 0, 10000000],
    ["analysis", "Análises por mês", 0, 10000000],
    ["warn", "Avisar ao atingir (%)", 1, 100],
    ["activity_days", "Guardar atividades por (dias)", 1, 730],
    ["error_days", "Guardar erros por (dias)", 1, 365],
  ] as const;
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate(new FormData(e.currentTarget));
      }}
    >
      <h3 className="font-semibold">Limites e retenção</h3>
      <p className="text-sm">
        O mês começa à meia-noite UTC. Um limite vazio permite uso ilimitado. Zero bloqueia novas
        admissões. Cada envio reserva sua primeira análise. Tentativas da mesma análise usam uma
        única reserva.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map(([key, label, min, max]) => (
          <label key={key} className="text-sm">
            {label}
            <Input
              name={key}
              defaultValue={policy[key] ?? ""}
              type="number"
              min={min}
              max={max}
              required={min > 0}
            />
          </label>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        A limpeza diária elimina do histórico operacional os eventos que excedem estes prazos,
        inclusive após uma redução.
      </p>
      <Button disabled={save.isPending}>Salvar configurações</Button>
    </form>
  );
}

function Invoice({
  companyId,
  month,
  job,
  attempt,
  value,
  label,
  refresh,
}: {
  companyId: string;
  month: string;
  job: string | null;
  attempt: number | null;
  value: number | null;
  label: string;
  refresh: () => Promise<void>;
}) {
  const save = useMutation({
    mutationFn: async (amount: number) => {
      const { error } = await supabase.rpc("ops_reconcile", {
        p_company: companyId,
        p_month: month + "-01",
        p_job: job,
        p_attempt: attempt,
        p_usd: amount,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await refresh();
      toast.success("Valor conciliado.");
    },
    onError: (e) => toast.error(errorFeedback(e).message),
  });
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    save.mutate(Number(new FormData(e.currentTarget).get("amount")));
  }
  return (
    <form className="flex flex-wrap items-end gap-2 py-2" onSubmit={submit}>
      <label className="text-sm">
        {label} (USD)
        <Input
          type="number"
          name="amount"
          min="0"
          max="1000000000"
          step="0.00000001"
          required
          defaultValue={value ?? ""}
        />
      </label>
      <Button variant="outline" disabled={save.isPending}>
        Confirmar valor
      </Button>
    </form>
  );
}

const labels: Record<string, string> = {
  candidate_created: "Cadastrou candidato",
  candidate_archived: "Arquivou candidato",
  candidate_review: "Revisou candidato",
  review_completed: "Concluiu revisão",
  job_created: "Cadastrou vaga",
  job_changed: "Alterou vaga",
  job_archived: "Arquivou vaga",
  note_added: "Adicionou observação",
  decision_saved: "Registrou decisão",
  link_changed: "Alterou vínculo",
  document_changed: "Alterou documento",
  case_review: "Revisou caso",
  ranking_published: "Recalculou classificação",
  analysis_requested: "Solicitou análise",
  report_generated: "Gerou relatório",
  report_view: "Consultou relatório",
  report_pdf: "Exportou PDF",
  report_csv: "Exportou planilha",
  erase_requested: "Solicitou eliminação",
  database_erased: "Eliminou registros",
  erase_completed: "Concluiu eliminação",
  subject_export: "Solicitou exportação",
  privacy_change: "Atualizou privacidade",
  hold_created: "Registrou retenção",
  hold_released: "Liberou retenção",
  member_insert: "Adicionou membro",
  member_update: "Alterou permissão",
  member_delete: "Retirou acesso",
  invitation_insert: "Criou convite",
  invitation_update: "Atualizou convite",
  settings_changed: "Alterou configurações",
  attempt_reconciled: "Conciliou custo de IA",
  storage_reconciled: "Conciliou armazenamento",
  query: "Consulta",
  save: "Gravação",
  upload: "Envio",
  review: "Revisão",
  reprocess: "Reprocessamento",
  rank: "Classificação",
  export: "Exportação",
  erase: "Eliminação",
  access: "Acesso",
  settings: "Configurações",
};
function History({ companyId }: { companyId: string }) {
  const [kind, setKind] = useState("activity"),
    [page, setPage] = useState(0);
  const query = useQuery({
    queryKey: ["company-activity", companyId, kind, page],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("ops_history", {
        p_company: companyId,
        p_kind: kind,
        p_page: page,
      });
      if (error) throw error;
      return data as Event[];
    },
    refetchInterval: 30000,
  });
  return (
    <div className="space-y-3">
      <label className="block text-sm">
        Tipo de histórico{" "}
        <select
          value={kind}
          onChange={(e) => {
            setKind(e.target.value);
            setPage(0);
          }}
          className="rounded border bg-background p-2"
        >
          <option value="activity">Atividades</option>
          <option value="error">Erros</option>
        </select>
      </label>
      {query.error ? (
        <QueryError error={query.error} retry={query.refetch} />
      ) : query.data ? (
        <>
          {!query.data.length && <p>Nenhum evento nesta página.</p>}
          <ol className="divide-y">
            {query.data.slice(0, 25).map((e) => (
              <li key={e.id} className="py-3 text-sm">
                <strong>{labels[e.action] ?? e.action}</strong> · {displayDate(e.at)}
                <div>
                  {e.actor_name || e.actor_id || "Sistema ou autor indisponível"}
                  {e.code && " · " + e.code}
                </div>
                <div className="break-all text-xs text-muted-foreground">
                  Operação {e.operation_id} · {e.source}
                </div>
              </li>
            ))}
          </ol>
          <PageButtons page={page} more={query.data.length > 25} change={setPage} />
        </>
      ) : (
        <LoadingState>Consultando histórico…</LoadingState>
      )}
    </div>
  );
}

export function CompanyOperations({ companyId }: { companyId: string }) {
  const [tab, setTab] = useState("usage"),
    [month, setMonth] = useState(today),
    [page, setPage] = useState(0);
  const cache = useQueryClient();
  const query = useQuery({
    queryKey: ["company-operations", companyId, month, page],
    enabled: tab !== "history",
    queryFn: async () => {
      const { data, error } = await supabase.rpc("ops_dashboard", {
        p_company: companyId,
        p_month: month + "-01",
        p_page: page,
      });
      if (error) throw error;
      return data as Dashboard;
    },
    refetchInterval: 30000,
  });
  async function refresh() {
    await Promise.all(
      ["company-usage", "company-operations", "company-activity"].map((k) =>
        cache.invalidateQueries({ queryKey: [k, companyId] }),
      ),
    );
  }
  const d = query.data;
  return (
    <section className="space-y-5 rounded-lg border p-5">
      <h2 className="text-lg font-semibold">Operações da empresa</h2>
      <div className="flex flex-wrap gap-2">
        {[
          ["usage", "Consumo"],
          ["limits", "Limites e retenção"],
          ["history", "Histórico"],
        ].map(([id, title]) => (
          <Button
            type="button"
            key={id}
            aria-pressed={id === tab}
            variant={id === tab ? "default" : "outline"}
            onClick={() => setTab(id!)}
          >
            {title}
          </Button>
        ))}
      </div>
      {tab === "history" ? (
        <History companyId={companyId} />
      ) : (
        <>
          {tab === "usage" && (
            <label className="block text-sm">
              Mês de referência (UTC)
              <Input
                type="month"
                value={month}
                max={today()}
                onChange={(e) => {
                  if (e.target.validity.valid && e.target.value) {
                    setMonth(e.target.value);
                    setPage(0);
                  }
                }}
              />
            </label>
          )}
          {query.error ? (
            <QueryError error={query.error} retry={query.refetch} />
          ) : !d ? (
            <LoadingState>Consultando operações…</LoadingState>
          ) : tab === "limits" ? (
            <Limits
              key={d.policy.version}
              companyId={companyId}
              policy={d.policy}
              refresh={refresh}
            />
          ) : (
            <>
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {Object.entries({
                  "Currículos enviados": number(d.received),
                  Concluídos: number(d.completed),
                  Recusados: number(d.rejected),
                  "Para revisão": number(d.review),
                  "Envios reservados": number(d.admissions),
                  "Análises reservadas": number(d.analyses),
                  Tentativas: number(d.attempts),
                  "Tentativas com falha": number(d.failures),
                  "Tempo médio (s)": number(d.duration_ms === null ? null : d.duration_ms / 1000),
                  "Tokens de entrada": number(d.input_tokens),
                  "Tokens de saída": number(d.output_tokens),
                  "Uso de armazenamento (MiB·h)": number(d.byte_hours / 1048576),
                }).map(([k, v]) => (
                  <div key={k} className="rounded border p-3">
                    <dt className="text-sm text-muted-foreground">{k}</dt>
                    <dd className="text-xl font-semibold">{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="text-sm">
                Os resultados contam currículos distintos por desfecho de tentativas iniciadas no
                mês. Um currículo reprocessado pode aparecer em dois desfechos. Tentativas sem
                medição de tokens: {d.unknown_tokens}.
              </p>
              <h3 className="font-semibold">Custo por análise no mês</h3>
              <p className="text-sm">
                Confirme o valor faturado de cada tentativa, incluindo repetições. Ao fechar o mês,
                informe o armazenamento de currículos atribuído à empresa. O rateio considera o
                tamanho e o tempo guardado de cada arquivo e divide sua parcela entre as análises.
              </p>
              {d.closed ? (
                <>
                  <Invoice
                    key={month + ":" + d.storage_bill}
                    companyId={companyId}
                    month={month}
                    job={null}
                    attempt={null}
                    value={d.storage_bill}
                    label="Armazenamento faturado no mês"
                    refresh={refresh}
                  />
                  {d.storage_unallocated_usd !== null && (
                    <p className="text-sm">
                      Armazenamento sem análise associada · {usd(d.storage_unallocated_usd)}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm">
                  Mês em andamento. O custo total fica disponível após fechamento e conciliação.
                </p>
              )}
              {!d.rows.length && <p>Nenhuma análise nesta competência.</p>}
              {d.rows.slice(0, 20).map((r) => (
                <details className="rounded border p-3 text-sm" key={r.job_id}>
                  <summary className="cursor-pointer">
                    Análise de {displayDate(r.queued_at)} · Versão {r.generation} ·{" "}
                    {usd(r.total_usd)}
                  </summary>
                  <p className="mt-2 break-all">Operação {r.job_id}</p>
                  <p>
                    IA {usd(r.ai_usd)} · Armazenamento {usd(r.storage_usd)}
                  </p>
                  {r.items.map((a) => (
                    <div className="mt-2 border-t pt-2" key={a.attempt}>
                      <p>
                        Tentativa {a.attempt} · {number(a.tokens)} tokens ·{" "}
                        {number(a.duration_ms === null ? null : a.duration_ms / 1000)} s
                      </p>
                      {a.finished ? (
                        <Invoice
                          key={String(a.usd)}
                          companyId={companyId}
                          month={month}
                          job={r.job_id}
                          attempt={a.attempt}
                          label={"IA faturada na tentativa " + a.attempt}
                          value={a.usd}
                          refresh={refresh}
                        />
                      ) : (
                        <p>Em processamento</p>
                      )}
                    </div>
                  ))}
                </details>
              ))}
              <PageButtons page={page} more={d.rows.length > 20} change={setPage} />
            </>
          )}
        </>
      )}
    </section>
  );
}
