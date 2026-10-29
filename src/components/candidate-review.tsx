import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { getResumeUrl } from "@/lib/resumes.functions";
import {
  reviewData,
  reviewPatch,
  reviewLabels,
  reviewError,
  reviewFieldName,
  yearsFromPeriods,
  type ReviewData,
  type ReviewEntry,
} from "@/lib/candidate-review";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

type Candidate = Database["public"]["Tables"]["candidates"]["Row"];
const format = (v: unknown) =>
  v === null || v === undefined
    ? "Não informado"
    : typeof v === "object"
      ? JSON.stringify(v, null, 2)
      : String(v);
export function CandidateReview({
  candidate,
  canEdit,
}: {
  candidate: Candidate;
  canEdit: boolean;
}) {
  const cache = useQueryClient();
  const sign = useServerFn(getResumeUrl);
  const [base, setBase] = useState(() => reviewData(candidate));
  const [draft, setDraft] = useState(() => reviewData(candidate));
  const [version, setVersion] = useState(candidate.review_version);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [limit, setLimit] = useState(20);
  const [original, setOriginal] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const patch = reviewPatch(base, draft);
  const dirty = Object.keys(patch).length > 0;
  const conflict = candidate.review_version !== version;
  const raw = (candidate.dados_extraidos ?? {}) as {
    controle_qualidade?: { motivos_revisao?: string[] };
    campos_incertos?: string[];
  };
  const reasons = [
    ...(!candidate.data_nascimento
      ? [
          "Data de nascimento não informada: confira quando necessária para aprendizagem, sem presumir idade ou excluir o candidato.",
        ]
      : []),
    ...new Set([
      ...(raw.controle_qualidade?.motivos_revisao ?? []),
      ...(raw.campos_incertos ?? []).map((f) => `${f}: informação incerta na leitura`),
    ]),
  ];
  const corrections = (candidate.correcoes_rh ?? {}) as Record<string, unknown>;
  const history = useQuery({
    queryKey: ["candidate-revisions", candidate.company_id, candidate.id, limit],
    refetchInterval: 5000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("candidate_revisions")
        .select("*")
        .eq("company_id", candidate.company_id)
        .eq("candidate_id", candidate.id)
        .order("version", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data;
    },
  });
  const scores = useQuery({
    queryKey: ["candidate-scores", candidate.company_id, candidate.id],
    refetchInterval: 5000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("candidate_scores")
        .select("id,job_id,stale,candidate_version,jobs(titulo)")
        .eq("company_id", candidate.company_id)
        .eq("candidate_id", candidate.id);
      if (error) throw error;
      return data;
    },
  });
  useEffect(() => {
    if (!dirty && !saving && candidate.review_version !== version) {
      const current = reviewData(candidate);
      setBase(current);
      setDraft(current);
      setVersion(candidate.review_version);
      setConfirmed(false);
    }
  }, [candidate, dirty, saving, version]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function change<K extends keyof ReviewData>(field: K, value: ReviewData[K]) {
    setDraft((d) => ({ ...d, [field]: value }));
    setMessage("");
    setFailed(false);
    setConfirmed(false);
  }
  function changeEntries(field: "experiencias" | "formacao_academica", entries: ReviewEntry[]) {
    setDraft((d) => ({
      ...d,
      [field]: entries,
      ...(field === "experiencias" ? { anos_experiencia_total: yearsFromPeriods(entries) } : {}),
    }));
    setMessage("");
    setConfirmed(false);
    setFailed(false);
  }
  async function save(complete: boolean) {
    if (!canEdit || saving || conflict) return;
    setSaving(true);
    setFailed(false);
    setMessage("Salvando…");
    try {
      const normalized = {
        ...draft,
        ...Object.fromEntries(
          (["skills", "idiomas", "certificacoes"] as const).map((k) => [
            k,
            [...new Set(draft[k].map((v) => v.trim()).filter(Boolean))],
          ]),
        ),
      };
      const { data, error } = await supabase.rpc("save_candidate_review", {
        p_company: candidate.company_id,
        p_candidate: candidate.id,
        p_expected_version: version,
        p_patch: reviewPatch(base, normalized) as Json,
        p_complete: complete,
        p_confirmed: confirmed,
      });
      if (error) throw error;
      const saved = data as unknown as Candidate;
      const current = reviewData(saved);
      setBase(current);
      setDraft(current);
      setVersion(saved.review_version);
      setConfirmed(false);
      cache.setQueryData(["candidate", candidate.company_id, candidate.id], saved);
      await Promise.all(
        ["candidates", "candidate-revisions", "candidate-scores", "job-scores"].map((key) =>
          cache.invalidateQueries({ queryKey: [key, candidate.company_id] }),
        ),
      );
      setMessage(complete ? "Revisão concluída e registrada." : "Alterações salvas.");
    } catch (error) {
      setFailed(true);
      setMessage(reviewError(error as { code?: string }));
      void cache.invalidateQueries({ queryKey: ["candidate", candidate.company_id, candidate.id] });
    } finally {
      setSaving(false);
    }
  }
  async function showOriginal() {
    setOpening(true);
    try {
      const { url } = await sign({
        data: { companyId: candidate.company_id, candidateId: candidate.id },
      });
      setOriginal(url);
    } catch {
      setMessage("Não foi possível abrir o original. Confira seu acesso e tente novamente.");
      setFailed(true);
    } finally {
      setOpening(false);
    }
  }
  function hints(field: string) {
    const matches = reasons.filter((reason) => reason.includes(field));
    return (
      <>
        {Object.hasOwn(corrections, field) && (
          <p className="text-xs text-muted-foreground">
            Valor preservado pelo RH ou pela conferência anterior.
          </p>
        )}
        {matches.map((reason) => (
          <p key={reason} className="text-xs text-amber-800 dark:text-amber-300">
            Conferir: {reviewFieldName(reason)}
          </p>
        ))}
      </>
    );
  }
  function entries(field: "experiencias" | "formacao_academica", fields: string[]) {
    return (
      <section className="space-y-3 border-t pt-4">
        <h3 className="font-semibold">{reviewLabels[field]}</h3>
        {hints(field)}
        {draft[field].map((entry, index) => (
          <div className="space-y-3 rounded-md border p-3" key={index}>
            <p className="text-sm font-medium">
              {reviewLabels[field]} · item {index + 1}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {fields.map((key) => (
                <div className="space-y-1" key={key}>
                  <Label htmlFor={`${field}-${index}-${key}`}>{reviewLabels[key]}</Label>
                  <Input
                    id={`${field}-${index}-${key}`}
                    maxLength={2000}
                    value={String(entry[key] ?? "")}
                    disabled={key === "fim" && entry.atual === true}
                    onChange={(e) =>
                      changeEntries(
                        field,
                        draft[field].map((item, i) =>
                          i === index ? { ...item, [key]: e.target.value || null } : item,
                        ),
                      )
                    }
                  />
                </div>
              ))}
            </div>
            {field === "experiencias" && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={entry.atual === true}
                  onChange={(e) =>
                    changeEntries(
                      field,
                      draft[field].map((item, i) =>
                        i === index
                          ? {
                              ...item,
                              atual: e.target.checked,
                              ...(e.target.checked ? { fim: null } : {}),
                            }
                          : item,
                      ),
                    )
                  }
                />
                Trabalho atual
              </label>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                changeEntries(
                  field,
                  draft[field].filter((_, i) => i !== index),
                )
              }
            >
              Remover item {index + 1}
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          disabled={draft[field].length >= 60}
          onClick={() =>
            changeEntries(field, [
              ...draft[field],
              Object.fromEntries([
                ...fields.map((key) => [key, null]),
                ...(field === "experiencias" ? [["atual", false]] : []),
              ]),
            ])
          }
        >
          Adicionar {field === "experiencias" ? "experiência" : "formação"}
        </Button>
      </section>
    );
  }
  const stale =
    scores.data?.filter((s) => s.stale || s.candidate_version !== candidate.data_version) ?? [];
  return (
    <Card>
      <CardHeader>
        <CardTitle>Revisão do currículo</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm">
          {candidate.review_status === "completed"
            ? `Revisão concluída em ${candidate.reviewed_at ? new Date(candidate.reviewed_at).toLocaleString("pt-BR") : "data não informada"}.`
            : candidate.review_status === "draft"
              ? "Revisão em andamento."
              : "Aguardando conferência do RH."}{" "}
          Alterações salvas aqui têm prioridade nas próximas leituras da IA.
        </p>
        {!!reasons.length && (
          <details
            open={candidate.review_status !== "completed"}
            className="rounded border border-amber-400 p-3 text-sm"
          >
            <summary className="cursor-pointer font-medium">
              Campos e motivos apontados pela IA ({reasons.length})
            </summary>
            <ul className="mt-2 list-disc pl-5">
              {reasons.map((r) => (
                <li key={r}>{reviewFieldName(r)}</li>
              ))}
            </ul>
            <p className="mt-2">
              Os apontamentos originais são preservados no histórico, mesmo após a conferência.
            </p>
          </details>
        )}
        {stale.length > 0 && (
          <div role="status" className="rounded border border-amber-400 p-3 text-sm">
            <p>Avaliações desatualizadas após alteração dos dados. Calcule novamente:</p>
            {stale.map((s) => (
              <Link className="mr-3 underline" key={s.id} to="/vagas/$id" params={{ id: s.job_id }}>
                {s.jobs?.titulo ?? "Vaga"}
              </Link>
            ))}
          </div>
        )}
        {dirty && !!scores.data?.length && (
          <p className="text-sm text-amber-800 dark:text-amber-300">
            Alterações nos dados do currículo tornarão as avaliações anteriores desatualizadas.
          </p>
        )}
        <div className={original ? "grid gap-5 xl:grid-cols-2" : ""}>
          <div>
            <Button type="button" variant="outline" disabled={opening} onClick={showOriginal}>
              {opening
                ? "Abrindo…"
                : original
                  ? "Renovar acesso ao original"
                  : "Conferir currículo original"}
            </Button>
            {original && (
              <aside className="mt-3 space-y-2 xl:sticky xl:top-4">
                <p className="text-sm">
                  {candidate.arquivo_nome} · arquivo original, sem alterações do RH.
                </p>
                <a
                  className="text-sm underline"
                  href={original}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Abrir ou baixar o original em outra aba
                </a>
                {/\.(pdf|png|jpe?g)$/i.test(candidate.arquivo_nome ?? "") ? (
                  <iframe
                    className="h-[65vh] w-full rounded border"
                    src={original}
                    title="Currículo original para conferência"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <p className="text-sm">
                    Para conferir DOCX, abra o arquivo no seu editor de documentos.
                  </p>
                )}
                <Button type="button" variant="ghost" onClick={() => setOriginal(null)}>
                  Fechar original
                </Button>
                <p className="text-xs text-muted-foreground">
                  Se o acesso expirar, use “Renovar acesso ao original”.
                </p>
              </aside>
            )}
          </div>
          <form
            className="mt-4 space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              void save(false);
            }}
          >
            {conflict && (
              <div role="alert" className="rounded border border-destructive p-3 text-sm">
                <p>
                  Este currículo foi alterado por outra pessoa ou por uma nova leitura. Seu rascunho
                  foi mantido e não será salvo por cima da versão atual.
                </p>
                <details>
                  <summary className="cursor-pointer underline">
                    Comparar com a versão atual
                  </summary>
                  {Object.keys(patch).map((key) => (
                    <div className="mt-2" key={key}>
                      <strong>{reviewLabels[key]}</strong>
                      <pre className="whitespace-pre-wrap">
                        Seu rascunho: {format(draft[key as keyof ReviewData])}
                      </pre>
                      <pre className="whitespace-pre-wrap">
                        Versão atual: {format(reviewData(candidate)[key as keyof ReviewData])}
                      </pre>
                    </div>
                  ))}
                </details>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-3"
                  onClick={() => {
                    if (
                      dirty &&
                      !window.confirm(
                        "Carregar a versão atual e descartar seu rascunho? Copie antes as correções que deseja reaplicar.",
                      )
                    )
                      return;
                    const current = reviewData(candidate);
                    setBase(current);
                    setDraft(current);
                    setVersion(candidate.review_version);
                    setConfirmed(false);
                    setMessage("");
                    setFailed(false);
                  }}
                >
                  Carregar versão atual
                </Button>
              </div>
            )}
            <fieldset disabled={!canEdit || saving} className="space-y-5 disabled:opacity-70">
              <div className="grid gap-4 sm:grid-cols-2">
                {(
                  ["nome_completo", "email", "telefone", "localizacao", "data_nascimento"] as const
                ).map((field) => (
                  <div key={field} className="space-y-1">
                    <Label htmlFor={`review-${field}`}>{reviewLabels[field]}</Label>
                    <Input
                      id={`review-${field}`}
                      type={
                        field === "data_nascimento" ? "date" : field === "email" ? "email" : "text"
                      }
                      maxLength={field === "email" ? 254 : 500}
                      value={draft[field] ?? ""}
                      onChange={(e) => change(field, e.target.value || null)}
                    />
                    {field === "localizacao" && (
                      <p className="text-xs text-muted-foreground">
                        Digite livremente e salve. Não depende de sugestões externas.
                      </p>
                    )}
                    {hints(field)}
                  </div>
                ))}
              </div>
              {entries("experiencias", [
                "empresa",
                "cargo",
                "inicio",
                "fim",
                "periodo",
                "descricao",
              ])}
              <div className="space-y-2">
                <Label htmlFor="review-years">Tempo de experiência (anos)</Label>
                <Input
                  id="review-years"
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={draft.anos_experiencia_total ?? ""}
                  onChange={(e) =>
                    change(
                      "anos_experiencia_total",
                      e.target.value === "" ? null : Number(e.target.value),
                    )
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Editar períodos recalcula o total sem somar meses sobrepostos. Períodos
                  incompletos deixam o total não informado. Você pode corrigir o total manualmente
                  após conferir o original.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    change("anos_experiencia_total", yearsFromPeriods(draft.experiencias))
                  }
                >
                  Recalcular pelos períodos
                </Button>
                {hints("anos_experiencia_total")}
              </div>
              {entries("formacao_academica", [
                "curso",
                "instituicao",
                "nivel",
                "inicio",
                "fim",
                "periodo",
              ])}
              {(["skills", "idiomas", "certificacoes"] as const).map((field) => (
                <div key={field} className="space-y-1">
                  <Label htmlFor={`review-${field}`}>
                    {reviewLabels[field]} (um item por linha)
                  </Label>
                  <Textarea
                    id={`review-${field}`}
                    value={draft[field].join("\n")}
                    rows={4}
                    onChange={(e) => change(field, e.target.value.split("\n"))}
                  />
                  {hints(field)}
                </div>
              ))}
              <div className="space-y-1">
                <Label htmlFor="review-status">Status no funil</Label>
                <select
                  id="review-status"
                  className="h-10 w-full rounded-md border bg-background px-3"
                  value={draft.status}
                  onChange={(e) => change("status", e.target.value)}
                >
                  {[
                    ["novo", "Novo"],
                    ["em_analise", "Em análise"],
                    ["aprovado", "Aprovado"],
                    ["rejeitado", "Rejeitado"],
                    ["contratado", "Contratado"],
                  ].map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="review-notes">Observações</Label>
                <Textarea
                  id="review-notes"
                  maxLength={10000}
                  value={draft.observacoes ?? ""}
                  onChange={(e) => change("observacoes", e.target.value || null)}
                />
              </div>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  className="mt-1"
                />
                Conferi o currículo original e os campos apontados. Informações ausentes foram
                mantidas como não informadas.
              </label>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={!dirty || conflict}>
                  {saving ? "Salvando…" : "Salvar alterações"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!confirmed || conflict}
                  onClick={() => void save(true)}
                >
                  Concluir revisão
                </Button>
              </div>
            </fieldset>
            {!canEdit && <p className="text-sm">Seu acesso permite apenas consulta.</p>}
            <p
              role={failed ? "alert" : "status"}
              aria-live="polite"
              className={failed ? "text-sm text-destructive" : "text-sm text-muted-foreground"}
            >
              {message || (dirty ? "Alterações ainda não salvas." : "Sem alterações pendentes.")}
            </p>
          </form>
        </div>
        <details className="border-t pt-4">
          <summary className="cursor-pointer font-medium">
            Comparar extração da IA e correções do RH
          </summary>
          <p className="my-2 text-sm">
            A extração é a última leitura da IA. O arquivo original permanece disponível acima.
            Listas corrigidas pelo RH são preservadas por inteiro nas próximas leituras.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th>Campo</th>
                  <th>Extração da IA</th>
                  <th>Valor preservado pelo RH</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(base)
                  .filter((k) => !["status", "observacoes"].includes(k))
                  .map((k) => (
                    <tr key={k} className="border-t align-top">
                      <th className="p-2">{reviewLabels[k]}</th>
                      <td className="p-2">
                        <pre className="max-w-sm whitespace-pre-wrap break-words">
                          {format((candidate.dados_extraidos as Record<string, unknown>)?.[k])}
                        </pre>
                      </td>
                      <td className="p-2">
                        <pre className="max-w-sm whitespace-pre-wrap break-words">
                          {Object.hasOwn(corrections, k)
                            ? format(corrections[k])
                            : "Sem correção ou confirmação humana"}
                        </pre>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </details>
        <details className="border-t pt-4">
          <summary className="cursor-pointer font-medium">Histórico de revisão</summary>
          {history.isError && <p role="alert">Não foi possível carregar o histórico.</p>}
          {history.isLoading && <p>Carregando histórico…</p>}
          {!history.isLoading && !history.data?.length && (
            <p className="mt-2 text-sm">Nenhuma revisão humana registrada.</p>
          )}
          {history.data?.map((revision) => (
            <div key={revision.id} className="my-3 rounded border p-3 text-sm">
              <p className="font-medium">
                {revision.action === "complete"
                  ? "Revisão concluída"
                  : revision.action === "legacy_baseline"
                    ? "Valores anteriores preservados; responsável não confirmado"
                    : "Correção salva"}{" "}
                · {new Date(revision.created_at).toLocaleString("pt-BR")}
              </p>
              {revision.action !== "legacy_baseline" && (
                <p>
                  {revision.actor_name || "Membro da equipe"} ·{" "}
                  {revision.actor_id ?? "Conta removida"} · versão {revision.version}
                </p>
              )}
              {revision.action === "complete" && (
                <p>
                  Todos os campos de revisão foram confirmados e protegidos contra substituição pela
                  IA.
                </p>
              )}
              {Object.entries(
                revision.changes as Record<string, { antes?: unknown; depois?: unknown }>,
              ).map(([key, value]) => (
                <details className="mt-2" key={key}>
                  <summary className="cursor-pointer">{reviewLabels[key] ?? key}</summary>
                  <pre className="whitespace-pre-wrap break-words">
                    Antes: {format(value.antes)}
                    {"\n"}Depois:{" "}
                    {format(
                      value.depois ?? (revision.action === "legacy_baseline" ? value : undefined),
                    )}
                  </pre>
                </details>
              ))}
            </div>
          ))}
          {history.data?.length === limit && (
            <Button variant="outline" onClick={() => setLimit((n) => n + 20)}>
              Carregar mais alterações
            </Button>
          )}
        </details>
      </CardContent>
    </Card>
  );
}
