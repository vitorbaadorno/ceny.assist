import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { Button } from "@/components/ui/button";
import { exportPrivacySubject } from "@/lib/privacy.functions";
import { toast } from "sonner";

export const ERASURE_SCOPE =
  "Remove os currículos e suas versões, extrações e tentativas da IA, correções, notas e decisões do RH, favoritos, vínculos, resultados de avaliação e busca e os relatórios que incluam estes cadastros. Relatórios compartilhados são removidos por inteiro; relatórios legados da empresa também são invalidados.";
export const ERASURE_RETAINED =
  "Mantém um registro administrativo mínimo da operação (identificadores, responsável, justificativa, datas e andamento), pedidos de titulares e justificativas de retenção. Cópias já baixadas, dados no fornecedor de IA e cópias de segurança exigem tratamento próprio; não há promessa de remoção imediata desses locais.";
type Preview = {
  candidate_ids: string[];
  documents: number;
  reports: number;
  legacy_reports: number;
  holds: number;
};
const date = (value: string) => new Date(value).toLocaleString("pt-BR");
const field = "rounded border bg-background p-2 text-sm w-full";

export function EraseCandidate({
  companyId,
  candidateId,
  onRequested,
}: {
  companyId: string;
  candidateId: string;
  onRequested?: () => void;
}) {
  const [preview, setPreview] = useState<Preview>();
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const cache = useQueryClient();
  const inspect = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("preview_candidate_erasure", {
        p_company: companyId,
        p_candidate: candidateId,
      });
      if (error) throw error;
      return data as unknown as Preview;
    },
    onSuccess: (value) => {
      setPreview(value);
      setConfirmed(false);
      setRequestId(crypto.randomUUID());
    },
    onError: () => toast.error("Não foi possível conferir o alcance da eliminação."),
  });
  const erase = useMutation({
    mutationFn: async () => {
      if (!preview || !confirmed) throw new Error("Confira o alcance antes de confirmar.");
      const { error } = await supabase.rpc("request_candidate_erasure", {
        p_company: companyId,
        p_candidate: candidateId,
        p_confirmed_ids: preview.candidate_ids,
        p_reason: reason.trim(),
        p_request: requestId,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      setPreview(undefined);
      await cache.invalidateQueries();
      toast.success("Eliminação solicitada. Acompanhe a conclusão em Privacidade e dados.");
      onRequested?.();
    },
    onError: (error) => toast.error(error.message),
  });
  return (
    <div className="space-y-3">
      <Button
        variant="destructive"
        disabled={inspect.isPending || erase.isPending}
        onClick={() => inspect.mutate()}
      >
        Eliminar dados…
      </Button>
      {preview && (
        <section
          aria-label="Confirmar eliminação"
          className="space-y-3 rounded border border-destructive p-4"
        >
          <h3 className="font-semibold">Eliminação definitiva — confira o alcance</h3>
          <p>
            {preview.candidate_ids.length} cadastro(s), {preview.documents} versão(ões) de
            currículo, {preview.reports} relatório(s) e {preview.legacy_reports} relatório(s)
            legado(s).
          </p>
          {preview.candidate_ids.length > 1 && (
            <p role="alert">
              Há cadastros reunidos. Todos os identificadores abaixo fazem parte da mesma
              eliminação.
            </p>
          )}
          <ul className="text-xs break-all">
            {preview.candidate_ids.map((id) => (
              <li key={id}>{id}</li>
            ))}
          </ul>
          <p className="text-sm">{ERASURE_SCOPE}</p>
          <p className="text-sm">{ERASURE_RETAINED}</p>
          <p className="text-sm">
            O acesso é bloqueado ao solicitar. Análises em andamento precisam encerrar sua reserva
            antes da remoção. A operação pode ficar pendente e será retomada; só o estado
            “Concluída” confirma a remoção do banco e dos arquivos ativos.
          </p>
          {!!preview.holds && (
            <p role="alert">
              Eliminação bloqueada por {preview.holds} retenção(ões) justificada(s). A data de
              revisão não libera a retenção automaticamente.
            </p>
          )}
          <label className="block text-sm">
            Justificativa ou referência interna, sem dados pessoais adicionais
            <textarea
              className={field}
              minLength={10}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            Conferi todos os cadastros e entendo o que será removido e mantido.
          </label>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={erase.isPending}
              onClick={() => setPreview(undefined)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={
                !confirmed || reason.trim().length < 10 || !!preview.holds || erase.isPending
              }
              onClick={() => erase.mutate()}
            >
              Solicitar eliminação definitiva
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}

export function PrivacyCenter({ onOpenCandidate }: { onOpenCandidate?: (() => void) | undefined }) {
  const { companyId, canAdmin } = useCompany();
  if (!canAdmin)
    return (
      <p role="alert">Somente responsáveis e administradores podem tratar pedidos e eliminações.</p>
    );
  return <PrivacyAdmin key={companyId} companyId={companyId} onOpenCandidate={onOpenCandidate} />;
}
function PrivacyAdmin({
  companyId,
  onOpenCandidate,
}: {
  companyId: string;
  onOpenCandidate?: (() => void) | undefined;
}) {
  const cache = useQueryClient();
  const download = useServerFn(exportPrivacySubject);
  const [page, setPage] = useState(0);
  const [historyPage, setHistoryPage] = useState(0);
  const [selected, setSelected] = useState("");
  const [kind, setKind] = useState("access");
  const [reference, setReference] = useState("");
  const [due, setDue] = useState("");
  const [holdReason, setHoldReason] = useState("");
  const [holdDate, setHoldDate] = useState("");
  const [identity, setIdentity] = useState("");
  const [resolution, setResolution] = useState("");
  const inventory = useQuery({
    queryKey: ["privacy-candidates", companyId, page],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("privacy_candidates", {
        p_company: companyId,
        p_offset: page * 50,
      });
      if (error) throw error;
      return data;
    },
  });
  const history = useQuery({
    queryKey: ["privacy-history", companyId, historyPage],
    queryFn: async () => {
      const from = historyPage * 50,
        to = from + 50;
      const [operations, holds, requests, events] = await Promise.all([
        supabase
          .from("privacy_erasure_operations")
          .select("*")
          .eq("company_id", companyId)
          .order("created_at", { ascending: false })
          .order("id")
          .range(from, to),
        supabase
          .from("privacy_retention_holds")
          .select("*")
          .eq("company_id", companyId)
          .order("created_at", { ascending: false })
          .order("id")
          .range(from, to),
        supabase
          .from("privacy_requests")
          .select("*")
          .eq("company_id", companyId)
          .order("created_at", { ascending: false })
          .order("id")
          .range(from, to),
        supabase
          .from("privacy_events")
          .select("*")
          .eq("company_id", companyId)
          .order("created_at", { ascending: false })
          .order("id")
          .range(from, to),
      ]);
      for (const r of [operations, holds, requests, events]) if (r.error) throw r.error;
      return {
        operations: operations.data!,
        holds: holds.data!,
        requests: requests.data!,
        events: events.data!,
      };
    },
    refetchInterval: (q) =>
      q.state.data?.operations.some((o) => o.state !== "completed") ? 10000 : false,
  });
  const action = useMutation({
    mutationFn: async (fn: () => PromiseLike<{ error: { message: string } | null }>) => {
      const { error } = await fn();
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: ["privacy-history", companyId] });
      toast.success("Registro atualizado.");
    },
    onError: (error) => toast.error(error.message),
  });
  const exporting = useMutation({
    mutationFn: async (requestId: string) => {
      const response = await download({ data: { companyId, requestId } });
      if (!response.ok) throw new Error("Exportação indisponível.");
      const url = URL.createObjectURL(await response.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `pedido-${requestId}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
    onSuccess: () => cache.invalidateQueries({ queryKey: ["privacy-history", companyId] }),
    onError: () =>
      toast.error("Não foi possível exportar. Confira seu acesso e a verificação de identidade."),
  });
  const records = history.data;
  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Privacidade e dados</h1>
        <p className="text-sm text-muted-foreground">
          Área interna de responsáveis e administradores. Cada providência deve ser conferida por
          uma pessoa autorizada.
        </p>
      </header>
      <section className="rounded border p-4 space-y-2">
        <h2 className="font-semibold">Definições pendentes de aprovação</h2>
        <p>
          Prazo de guarda dos currículos, dados derivados, registros administrativos e backups:{" "}
          <strong>pendente</strong>. Eliminação automática por prazo: <strong>desativada</strong>.
        </p>
        <p>
          Responsáveis, bases de tratamento e revisão jurídica: pendentes. Contrato/DPA, retenção e
          uso de dados pelo fornecedor de IA: pendentes. Política de backup e validação da
          recuperação em ambiente hospedado: pendentes.
        </p>
        <p className="text-sm">
          Os controles desta tela não representam uma certificação de conformidade com a LGPD.
          Registre referências internas; evite copiar documentos, diagnósticos ou informações
          pessoais nas justificativas.
        </p>
      </section>
      {(inventory.isError || history.isError) && (
        <p role="alert">
          Falha ao carregar os registros. Recarregue antes de tomar uma decisão; listas vazias não
          confirmam ausência de dados.
        </p>
      )}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Cadastros ativos e arquivados</h2>
        <label className="block">
          Cadastro
          <select className={field} value={selected} onChange={(e) => setSelected(e.target.value)}>
            <option value="">Selecione um cadastro</option>
            {inventory.data?.slice(0, 50).map((c) => (
              <option key={c.id} value={c.id}>
                {c.label} · {c.archived ? "arquivado" : "ativo"} · {c.id}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={page === 0}
            onClick={() => {
              setPage(page - 1);
              setSelected("");
            }}
          >
            Anteriores
          </Button>
          <Button
            variant="outline"
            disabled={(inventory.data?.length ?? 0) <= 50}
            onClick={() => {
              setPage(page + 1);
              setSelected("");
            }}
          >
            Mais cadastros
          </Button>
        </div>
        <p className="text-sm">
          Arquivar retira o cadastro e o original do acesso da equipe, mantendo os dados para
          revisão administrativa. Eliminar remove os dados ativos de forma definitiva, com o alcance
          confirmado abaixo.
        </p>
        {selected && (
          <>
            <p className="break-all text-xs">Cadastro selecionado: {selected}</p>
            <EraseCandidate
              key={selected}
              companyId={companyId}
              candidateId={selected}
              onRequested={() => setSelected("")}
            />
            {!inventory.data?.find((c) => c.id === selected)?.archived && (
              <Link
                onClick={onOpenCandidate}
                className="block text-sm underline"
                to="/candidatos/$id"
                params={{ id: selected }}
              >
                Consultar e corrigir dados na revisão do RH
              </Link>
            )}
          </>
        )}
      </section>
      <section className="space-y-3 rounded border p-4">
        <h2 className="font-semibold">Registrar pedido de titular</h2>
        <p className="text-sm">
          Selecione o cadastro acima. A referência identifica o protocolo interno; a data é de
          acompanhamento e não substitui a análise do prazo legal aplicável.
        </p>
        <label className="block">
          Tipo
          <select className={field} value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="access">Consulta</option>
            <option value="correction">Correção</option>
            <option value="export">Exportação</option>
            <option value="erasure">Eliminação</option>
          </select>
        </label>
        <label className="block">
          Referência do protocolo
          <input
            className={field}
            maxLength={200}
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
        </label>
        <label className="block">
          Acompanhar em
          <input
            type="date"
            className={field}
            value={due}
            onChange={(e) => setDue(e.target.value)}
          />
        </label>
        <Button
          disabled={!selected || reference.trim().length < 5 || !due || action.isPending}
          onClick={() =>
            action.mutate(() =>
              supabase.rpc("save_privacy_request", {
                p_company: companyId,
                p_candidate: selected,
                p_kind: kind,
                p_reference: reference,
                p_due_at: new Date(due + "T12:00:00").toISOString(),
              }),
            )
          }
        >
          Registrar pedido
        </Button>
      </section>
      <section className="space-y-3 rounded border p-4">
        <h2 className="font-semibold">Retenção justificada</h2>
        <p className="text-sm">
          Impede a eliminação do cadastro selecionado até liberação expressa. A data serve para
          revisão, sem expiração automática. A justificativa deve indicar a necessidade e a
          referência da validação responsável.
        </p>
        <label className="block">
          Justificativa de manutenção ou de liberação
          <textarea
            className={field}
            value={holdReason}
            maxLength={1000}
            onChange={(e) => setHoldReason(e.target.value)}
          />
        </label>
        <label className="block">
          Revisar em
          <input
            type="date"
            className={field}
            value={holdDate}
            onChange={(e) => setHoldDate(e.target.value)}
          />
        </label>
        <Button
          disabled={!selected || holdReason.trim().length < 15 || !holdDate || action.isPending}
          onClick={() =>
            action.mutate(() =>
              supabase.rpc("set_privacy_hold", {
                p_company: companyId,
                p_candidate: selected,
                p_reason: holdReason,
                p_review_at: new Date(holdDate + "T12:00:00").toISOString(),
              }),
            )
          }
        >
          Registrar retenção
        </Button>
        {records?.holds.slice(0, 50).map((h) => (
          <article key={h.id} className="border-t pt-3 text-sm space-y-1">
            <p className="break-all">
              {h.candidate_id} · {h.released_at ? "Liberada" : "Ativa"} · revisar em{" "}
              {date(h.review_at)}
            </p>
            <p>{h.reason}</p>
            <p>{h.release_reason}</p>
            {!h.released_at && (
              <Button
                variant="outline"
                disabled={holdReason.trim().length < 15 || action.isPending}
                onClick={() =>
                  action.mutate(() =>
                    supabase.rpc("set_privacy_hold", {
                      p_company: companyId,
                      p_candidate: h.candidate_id,
                      p_release: h.id,
                      p_reason: holdReason,
                      p_review_at: h.review_at,
                    }),
                  )
                }
              >
                Liberar com a justificativa preenchida
              </Button>
            )}
          </article>
        ))}
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Tratamento dos pedidos</h2>
        <label className="block">
          Referência da verificação de identidade
          <input
            className={field}
            value={identity}
            maxLength={200}
            onChange={(e) => setIdentity(e.target.value)}
          />
        </label>
        <label className="block">
          Resolução e referência da providência
          <textarea
            className={field}
            value={resolution}
            maxLength={1000}
            onChange={(e) => setResolution(e.target.value)}
          />
        </label>
        <p className="text-sm">
          A exportação JSON é um pacote para revisão interna: contém dados pessoais necessários ao
          pedido. Confira referências a terceiros e complemente originais ou informações faltantes
          antes da entrega por canal autorizado. Nenhum envio ao titular ocorre nesta tela.
        </p>
        {records?.requests.slice(0, 50).map((r) => (
          <article key={r.id} className="rounded border p-3 space-y-2">
            <p>
              {r.reference} ·{" "}
              {
                {
                  access: "Consulta",
                  correction: "Correção",
                  export: "Exportação",
                  erasure: "Eliminação",
                }[r.kind]
              }{" "}
              ·{" "}
              {
                {
                  open: "Aberto",
                  verified: "Identidade verificada",
                  completed: "Concluído",
                  declined: "Recusado com justificativa",
                }[r.state]
              }
            </p>
            <p className="text-xs break-all">
              {r.candidate_id} · acompanhar em {date(r.due_at)}
            </p>
            <p className="text-sm">{r.resolution}</p>
            <div className="flex flex-wrap gap-2">
              {["open", "verified"].includes(r.state) && (
                <>
                  {(r.state === "open" ? ["verified", "declined"] : ["completed", "declined"]).map(
                    (state) => (
                      <Button
                        key={state}
                        variant="outline"
                        disabled={
                          action.isPending ||
                          (state !== "declined" && identity.trim().length < 5) ||
                          (state !== "verified" && resolution.trim().length < 10)
                        }
                        onClick={() =>
                          action.mutate(() =>
                            supabase.rpc("save_privacy_request", {
                              p_company: companyId,
                              p_candidate: r.candidate_id,
                              p_kind: r.kind,
                              p_reference: r.reference,
                              p_due_at: r.due_at,
                              p_id: r.id,
                              p_version: r.version,
                              p_state: state,
                              p_identity: identity,
                              p_resolution: resolution,
                            }),
                          )
                        }
                      >
                        {
                          {
                            verified: "Confirmar identidade",
                            completed: "Concluir pedido",
                            declined: "Recusar com justificativa",
                          }[state]
                        }
                      </Button>
                    ),
                  )}
                </>
              )}
              {r.state === "verified" && ["access", "export"].includes(r.kind) && (
                <Button disabled={exporting.isPending} onClick={() => exporting.mutate(r.id)}>
                  Baixar pacote para revisão
                </Button>
              )}
            </div>
          </article>
        ))}
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Andamento das eliminações</h2>
        {records?.operations.slice(0, 50).map((o) => (
          <article key={o.id} className="rounded border p-3 space-y-2">
            <p className="font-medium">
              {
                {
                  queued: "Aguardando remoção do banco",
                  files_pending: "Banco removido; arquivos pendentes",
                  completed: "Concluída",
                }[o.state]
              }
            </p>
            <p className="text-xs break-all">
              Operação {o.id} · {o.candidate_ids.length} cadastro(s) · {date(o.created_at)} ·{" "}
              {o.attempts} tentativa(s)
            </p>
            <p className="text-sm">{o.reason}</p>
            {o.last_error && <p role="status">{o.last_error}</p>}
            {o.state !== "completed" && (
              <p className="text-sm">
                Próxima tentativa a partir de {date(o.available_at)}. Se continuar pendente, acione
                o responsável técnico com o número da operação.
              </p>
            )}
            {o.state === "files_pending" && (
              <Button
                variant="outline"
                disabled={action.isPending}
                onClick={() =>
                  action.mutate(() =>
                    supabase.rpc("retry_privacy_erasure", {
                      p_company: companyId,
                      p_operation: o.id,
                    }),
                  )
                }
              >
                Solicitar nova tentativa
              </Button>
            )}
          </article>
        ))}
      </section>
      <details className="rounded border p-4">
        <summary>Auditoria administrativa</summary>
        <ul className="text-xs break-all space-y-2 mt-3">
          {records?.events.slice(0, 50).map((e) => (
            <li key={e.id}>
              {date(e.created_at)} · {e.action} · responsável: {e.actor_id ?? "sistema"} · registro:{" "}
              {e.subject_id}
            </li>
          ))}
        </ul>
      </details>
      <div className="flex gap-2">
        <Button
          variant="outline"
          disabled={historyPage === 0}
          onClick={() => setHistoryPage(historyPage - 1)}
        >
          Histórico anterior
        </Button>
        <span>Página {historyPage + 1}</span>
        <Button
          variant="outline"
          disabled={!records || !Object.values(records).some((v) => v.length > 50)}
          onClick={() => setHistoryPage(historyPage + 1)}
        >
          Histórico seguinte
        </Button>
      </div>
    </div>
  );
}
