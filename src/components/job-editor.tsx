import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, Json } from "@/integrations/supabase/types";
import {
  criterionLabels,
  normalizeCriteria,
  suggestCriteria,
  validateJobPayload,
  type JobCriterion,
  type JobPayload,
} from "../../supabase/functions/_shared/job-criteria";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const JOB_RULE =
  "A nota soma o atendimento de cada critério proporcionalmente ao seu peso. Experiência pode ter atendimento parcial. Se algum obrigatório não estiver comprovado, a nota fica limitada a 49%. A avaliação apoia a revisão do RH e não exclui candidatos.";
const blank: JobPayload = { titulo: "", descricao: "", categoria: "regular", criteria: [] };
const fromJob = (job?: Tables<"jobs">): JobPayload =>
  job
    ? {
        titulo: job.titulo,
        descricao: job.descricao ?? "",
        categoria: job.categoria as JobPayload["categoria"],
        criteria: job.criteria as unknown as JobCriterion[],
      }
    : blank;
export function jobError(error: { code?: string; message?: string }) {
  if (error.code === "40001")
    return "Outra pessoa alterou esta vaga. Suas edições foram mantidas na tela. Confira a versão atual antes de salvar novamente.";
  if (error.code === "42501")
    return "Seu acesso não permite alterar esta vaga. Confira a empresa e sua permissão.";
  if (!error.code || error.code === "22023") return error.message ?? "Confira os dados da vaga.";
  return "Não foi possível salvar. Confira os dados e tente novamente.";
}
export function JobEditor({
  companyId,
  job,
  onSaved,
  onCancel,
}: {
  companyId: string;
  job?: Tables<"jobs">;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<JobPayload>(() => fromJob(job));
  const [version, setVersion] = useState(job?.version ?? 0);
  const [confirmed, setConfirmed] = useState(false);
  const [suggestions, setSuggestions] = useState<JobCriterion[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const changedElsewhere = !!job && job.version !== version;
  const change = (next: JobPayload) => {
    setForm(next);
    setConfirmed(false);
    setError("");
    setMessage("");
  };
  const { data: templates = [] } = useQuery({
    queryKey: ["job-templates", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_templates")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const save = useMutation({
    mutationFn: async (approve: boolean) => {
      if (approve && !confirmed)
        throw new Error("Confirme a conferência da descrição e dos critérios.");
      const payload = validateJobPayload(form, approve);
      const { error } = await supabase.rpc("save_job", {
        p_company: companyId,
        p_job: job?.id ?? null,
        p_expected_version: version,
        p_payload: payload as unknown as Json,
        p_approve: approve,
      });
      if (error) throw error;
      return { approve, merged: payload.criteria.length !== form.criteria.length };
    },
    onSuccess: async ({ approve, merged }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["jobs", companyId] }),
        queryClient.invalidateQueries({ queryKey: ["job", companyId] }),
        queryClient.invalidateQueries({ queryKey: ["job-revisions", companyId] }),
        queryClient.invalidateQueries({ queryKey: ["job-scores", companyId] }),
      ]);
      toast.success(
        `${approve ? "Vaga salva e critérios aprovados." : "Vaga salva."}${merged ? " Requisitos repetidos foram unificados." : ""}`,
      );
      onSaved();
    },
    onError: (e) => setError(jobError(e)),
  });
  const saveTemplate = useMutation({
    mutationFn: async () => {
      if (templateName.trim().length < 3 || templateName.trim().length > 160)
        throw new Error("Dê ao modelo um nome de 3 a 160 caracteres.");
      const payload = validateJobPayload(form);
      const { error } = await supabase.rpc("create_job_template", {
        p_company: companyId,
        p_name: templateName.trim(),
        p_payload: payload as unknown as Json,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job-templates", companyId] });
      setMessage("Modelo salvo para reutilização pela equipe.");
      setError("");
      setTemplateName("");
    },
    onError: (e) => setError(jobError(e)),
  });
  const updateCriterion = (index: number, patch: Partial<JobCriterion>) =>
    change({
      ...form,
      criteria: form.criteria.map((c, i) => (i === index ? { ...c, ...patch } : c)),
    });
  const busy = save.isPending || saveTemplate.isPending;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{job ? "Editar vaga e critérios" : "Nova vaga"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            setError("");
            save.mutate(false);
          }}
        >
          <fieldset disabled={busy} className="space-y-5 disabled:opacity-70">
            {changedElsewhere && (
              <div role="alert" className="rounded-lg border border-amber-400 p-3 text-sm">
                Esta vaga mudou desde que você abriu a edição. Seu rascunho permanece aqui.
                <Button
                  type="button"
                  variant="outline"
                  className="mt-2 block"
                  onClick={() => {
                    change(fromJob(job));
                    setVersion(job.version);
                    setSuggestions([]);
                  }}
                >
                  Descartar meu rascunho e carregar a versão atual
                </Button>
              </div>
            )}
            <details className="rounded-lg border p-3">
              <summary className="cursor-pointer text-sm font-medium">
                Usar ou salvar um modelo de vaga
              </summary>
              <div className="mt-3 space-y-3">
                <label className="block text-sm">
                  Modelo da empresa
                  <select
                    className="mt-1 w-full rounded-md border bg-background p-2"
                    value={templateId}
                    onChange={(e) => setTemplateId(e.target.value)}
                  >
                    <option value="">Selecione um modelo</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </label>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!templateId}
                  onClick={() => {
                    const t = templates.find((item) => item.id === templateId);
                    if (t) {
                      change(t.payload as unknown as JobPayload);
                      setSuggestions([]);
                    }
                  }}
                >
                  Substituir este rascunho pelo modelo
                </Button>
                <p className="text-xs text-muted-foreground">
                  A aprovação não é copiada. Confira os critérios para a nova vaga.
                </p>
                <label className="block text-sm">
                  Nome do novo modelo
                  <Input
                    value={templateName}
                    maxLength={160}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="Ex.: Analista de atendimento"
                  />
                </label>
                <Button type="button" variant="outline" onClick={() => saveTemplate.mutate()}>
                  Salvar rascunho como modelo
                </Button>
              </div>
            </details>
            <label className="block space-y-1 text-sm font-medium">
              Título
              <Input
                required
                minLength={3}
                maxLength={160}
                value={form.titulo}
                onChange={(e) => change({ ...form, titulo: e.target.value })}
              />
            </label>
            <label className="block space-y-1 text-sm font-medium">
              Categoria
              <select
                className="w-full rounded-md border bg-background p-2"
                value={form.categoria}
                onChange={(e) =>
                  change({ ...form, categoria: e.target.value as JobPayload["categoria"] })
                }
              >
                <option value="regular">Vaga regular</option>
                <option value="jovem_aprendiz">Jovem Aprendiz</option>
              </select>
            </label>
            <label className="block space-y-1 text-sm font-medium">
              Descrição
              <Textarea
                rows={6}
                maxLength={20000}
                value={form.descricao}
                onChange={(e) => {
                  change({ ...form, descricao: e.target.value });
                  setSuggestions([]);
                }}
                placeholder={
                  "Descreva as atividades.\nRequisitos:\n- Excel\nDiferenciais:\n- Power BI"
                }
              />
            </label>
            <div className="space-y-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const items = suggestCriteria(form.descricao);
                  setSuggestions(items);
                  setSelected([]);
                  setMessage(
                    items.length
                      ? "Selecione apenas os requisitos identificados corretamente. Depois confira tipo, peso e obrigatoriedade."
                      : "Nenhum requisito identificado. Use seções Requisitos e Diferenciais, com um item por linha, ou adicione manualmente.",
                  );
                }}
              >
                Identificar requisitos na descrição
              </Button>
              <p className="text-xs text-muted-foreground">
                Sugestões por trechos da descrição. Revise cada item antes de incluí-lo.
              </p>
            </div>
            {suggestions.length > 0 && (
              <div className="space-y-3 rounded-lg border p-3">
                <p className="font-medium">Conferir sugestões</p>
                {suggestions.map((c, i) => (
                  <label key={i} className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selected.includes(i)}
                      onChange={(e) =>
                        setSelected(
                          e.target.checked ? [...selected, i] : selected.filter((v) => v !== i),
                        )
                      }
                    />
                    <span>
                      {c.text}{" "}
                      <span className="text-muted-foreground">
                        — {c.required ? "obrigatório" : "diferencial"}
                      </span>
                    </span>
                  </label>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  disabled={!selected.length}
                  onClick={() => {
                    change({
                      ...form,
                      criteria: [
                        ...form.criteria,
                        ...suggestions.filter((_, i) => selected.includes(i)),
                      ],
                    });
                    setSuggestions([]);
                  }}
                >
                  Adicionar sugestões selecionadas
                </Button>
              </div>
            )}
            <div className="space-y-3">
              <h3 className="font-medium">Critérios da avaliação</h3>
              <p className="text-sm text-muted-foreground">{JOB_RULE}</p>
              {form.criteria.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Adicione os requisitos que serão avaliados.
                </p>
              )}
              {form.criteria.map((c, i) => (
                <div key={i} className="space-y-3 rounded-lg border p-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className="space-y-1 text-sm">
                      Tipo
                      <select
                        aria-label={`Tipo do critério ${i + 1}`}
                        className="block w-full rounded-md border bg-background p-2"
                        value={c.kind}
                        onChange={(e) =>
                          updateCriterion(i, {
                            kind: e.target.value as JobCriterion["kind"],
                            min_years: e.target.value === "experience" ? 0 : null,
                          })
                        }
                      >
                        {Object.entries(criterionLabels).map(([key, label]) => (
                          <option value={key} key={key}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1 text-sm">
                      Exigência
                      <select
                        className="block w-full rounded-md border bg-background p-2"
                        value={c.required ? "required" : "desired"}
                        onChange={(e) =>
                          updateCriterion(i, { required: e.target.value === "required" })
                        }
                      >
                        <option value="required">Obrigatório</option>
                        <option value="desired">Diferencial desejável</option>
                      </select>
                    </label>
                    <label className="space-y-1 text-sm">
                      Importância (peso 1–100)
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        step={1}
                        value={Number.isNaN(c.weight) ? "" : c.weight}
                        onChange={(e) =>
                          updateCriterion(i, {
                            weight: e.target.value === "" ? NaN : Number(e.target.value),
                          })
                        }
                      />
                    </label>
                  </div>
                  <label className="block space-y-1 text-sm">
                    {c.kind === "experience"
                      ? "Identificação do critério"
                      : "Termo que deverá constar nos dados do candidato"}
                    <Input
                      required
                      maxLength={200}
                      value={c.text}
                      onChange={(e) => updateCriterion(i, { text: e.target.value })}
                      placeholder={
                        c.kind === "education"
                          ? "Ex.: Administração"
                          : c.kind === "location"
                            ? "Ex.: Curitiba"
                            : "Ex.: Excel"
                      }
                    />
                  </label>
                  {c.kind === "experience" && (
                    <label className="block space-y-1 text-sm">
                      Experiência mínima (anos)
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step="any"
                        value={c.min_years === null || Number.isNaN(c.min_years) ? "" : c.min_years}
                        onChange={(e) =>
                          updateCriterion(i, {
                            min_years: e.target.value === "" ? NaN : Number(e.target.value),
                          })
                        }
                      />
                    </label>
                  )}
                  {c.source && (
                    <div className="text-xs text-muted-foreground">
                      <p>Trecho de origem: “{c.source}”</p>
                      <Button
                        type="button"
                        variant="link"
                        className="h-auto px-0 text-xs"
                        onClick={() => updateCriterion(i, { source: null })}
                      >
                        Conferi manualmente este requisito; remover o vínculo com o trecho
                      </Button>
                    </div>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      change({ ...form, criteria: form.criteria.filter((_, n) => i !== n) })
                    }
                  >
                    Remover critério {i + 1}
                  </Button>
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={form.criteria.length >= 60}
                  onClick={() =>
                    change({
                      ...form,
                      criteria: [
                        ...form.criteria,
                        {
                          kind: "skill",
                          text: "",
                          min_years: null,
                          required: true,
                          weight: 5,
                          source: null,
                        },
                      ],
                    })
                  }
                >
                  Adicionar critério
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    try {
                      const unique = normalizeCriteria(form.criteria);
                      const count = form.criteria.length - unique.length;
                      change({ ...form, criteria: unique });
                      setMessage(
                        count
                          ? `${count} repetição(ões) removida(s). Mantidos o maior peso e a exigência obrigatória.`
                          : "Não há requisitos repetidos.",
                      );
                    } catch (e) {
                      setError(jobError(e as Error));
                    }
                  }}
                >
                  Remover repetidos
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Repetições também são unificadas ao salvar. Termos de formação e localização são
              comparados com esses campos; competências usam termos dos dados profissionais. Não há
              interpretação semântica nesta avaliação.
            </p>
            {job && (
              <p className="rounded-md bg-muted p-3 text-sm">
                Alterar a descrição ou os critérios exige nova aprovação e novo cálculo de
                aderência. As avaliações anteriores permanecem visíveis como desatualizadas até
                serem substituídas pelo recálculo.
              </p>
            )}
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              <span>
                Conferi a descrição, os requisitos, a obrigatoriedade e os pesos. Os critérios
                representam as exigências aprovadas pelo RH.
              </span>
            </label>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" variant="outline" disabled={changedElsewhere}>
                Salvar rascunho
              </Button>
              <Button
                type="button"
                disabled={!confirmed || changedElsewhere}
                onClick={() => {
                  setError("");
                  save.mutate(true);
                }}
              >
                Salvar e aprovar critérios
              </Button>
              <Button type="button" variant="ghost" onClick={onCancel}>
                Cancelar
              </Button>
            </div>
          </fieldset>
          <div aria-live="polite" className="text-sm">
            {busy ? "Salvando…" : message}
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

export function JobHistory({ companyId, jobId }: { companyId: string; jobId: string }) {
  const [page, setPage] = useState(0);
  const {
    data: rows = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["job-revisions", companyId, jobId, page],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_revisions")
        .select("*")
        .eq("company_id", companyId)
        .eq("job_id", jobId)
        .order("version", { ascending: false })
        .range(page * 20, page * 20 + 19);
      if (error) throw error;
      return data;
    },
  });
  const labels: Record<string, string> = {
    create: "Vaga criada",
    edit: "Vaga alterada",
    approve: "Critérios aprovados",
    aberta: "Vaga reaberta",
    encerrada: "Vaga encerrada",
    archive: "Vaga arquivada",
    legacy_baseline: "Registro anterior à revisão",
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Histórico da vaga e dos critérios</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && <p>Carregando histórico…</p>}
        {isError && <p role="alert">Não foi possível carregar o histórico.</p>}
        {rows.map((row) => {
          const before = row.before_data as Record<string, Json> | null,
            after = row.after_data as Record<string, Json>;
          const fields: Record<string, string> = {
            titulo: "Título",
            descricao: "Descrição",
            categoria: "Categoria",
            criteria: "Critérios e pesos",
            status: "Situação",
            approved_hash: "Aprovação",
          };
          return (
            <details key={row.id} className="rounded-lg border p-3 text-sm">
              <summary className="cursor-pointer">
                {labels[row.action] ?? "Vaga alterada"} · versão {row.version}
                <span className="mt-1 block text-xs text-muted-foreground">
                  {row.actor_name ||
                    (row.actor_id ? `Membro ${row.actor_id}` : "Sistema / registro anterior")}{" "}
                  · {new Date(row.created_at).toLocaleString("pt-BR")}
                </span>
              </summary>
              <div className="mt-3 space-y-2">
                {Object.entries(fields)
                  .filter(
                    ([key]) =>
                      !before || JSON.stringify(before[key]) !== JSON.stringify(after[key]),
                  )
                  .map(([key, label]) => (
                    <div key={key}>
                      <p className="font-medium">{label}</p>
                      {key === "approved_hash" ? (
                        <p>
                          {after[key]
                            ? "Descrição e critérios aprovados"
                            : "Aguardando conferência"}
                        </p>
                      ) : (
                        <div className="grid gap-2 sm:grid-cols-2">
                          <pre className="whitespace-pre-wrap break-words rounded bg-muted p-2 text-xs">
                            Antes:{" "}
                            {key === "criteria"
                              ? renderCriteria(before?.[key])
                              : String(before?.[key] ?? "—")}
                          </pre>
                          <pre className="whitespace-pre-wrap break-words rounded bg-muted p-2 text-xs">
                            Depois:{" "}
                            {key === "criteria"
                              ? renderCriteria(after[key])
                              : String(after[key] ?? "—")}
                          </pre>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </details>
          );
        })}
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
          >
            Mais recentes
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={rows.length < 20}
            onClick={() => setPage(page + 1)}
          >
            Mais antigas
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
function renderCriteria(value: Json | undefined) {
  if (!Array.isArray(value)) return "—";
  return (
    (value as unknown as JobCriterion[])
      .map(
        (c) =>
          `${c.text}${c.kind === "experience" ? ` (${c.min_years} anos)` : ""} · ${c.required ? "obrigatório" : "diferencial"} · peso ${c.weight}${c.source ? ` · origem: ${c.source}` : ""}`,
      )
      .join("\n") || "Sem critérios"
  );
}
