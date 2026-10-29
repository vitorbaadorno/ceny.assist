import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Textarea } from "./ui/textarea";

export function CandidateDuplicates({
  candidate,
  canAdmin,
}: {
  candidate: Tables<"candidates">;
  canAdmin: boolean;
}) {
  const cache = useQueryClient();
  const navigate = useNavigate();
  const [target, setTarget] = useState<{
    candidate_id: string;
    nome: string | null;
    review_version: number;
    sourceVersion: number;
  } | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [reason, setReason] = useState("");
  const query = useQuery({
    queryKey: ["candidate-duplicates", candidate.company_id, candidate.id, candidate.data_version],
    refetchInterval: 5000,
    queryFn: async () => {
      const r = await supabase.rpc("suggest_candidate_duplicates", {
        p_company: candidate.company_id,
        p_candidate: candidate.id,
      });
      if (r.error) throw r.error;
      return r.data;
    },
  });
  const selected = target;
  const merge = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Confira o destino.");
      const r = await supabase.rpc("confirm_candidate_merge", {
        p_company: candidate.company_id,
        p_source: candidate.id,
        p_target: selected.candidate_id,
        p_source_version: selected.sourceVersion,
        p_target_version: selected.review_version,
        p_reason: reason,
        p_confirmed: confirmed,
      });
      if (r.error) throw r.error;
      return r.data;
    },
    onSuccess: async (id) => {
      await cache.invalidateQueries();
      toast.success("Documentos reunidos. Confira a revisão do cadastro mantido.");
      navigate({ to: "/candidatos/$id", params: { id } });
    },
    onError: () =>
      toast.error(
        "Não foi possível reunir. Atualize os cadastros, confira seu acesso e aguarde ou cancele leituras e envios pendentes.",
      ),
  });
  const history = useQuery({
    queryKey: ["candidate-merges", candidate.company_id, candidate.id],
    queryFn: async () => {
      const r = await supabase
        .from("candidate_merges")
        .select("*")
        .eq("company_id", candidate.company_id)
        .eq("target_id", candidate.id)
        .order("created_at", { ascending: false });
      if (r.error) throw r.error;
      return r.data;
    },
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Conferência de possíveis duplicados</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          E-mail ou telefone coincidente sugere uma conferência, mas pode ser compartilhado por
          pessoas diferentes. Nomes iguais nunca unem cadastros. Somente dados desta empresa são
          comparados.
        </p>
        {query.isError && <p role="alert">Não foi possível conferir os contatos.</p>}
        {query.data?.length === 0 && (
          <p className="text-sm">
            Nenhuma coincidência de contato encontrada. Dados ausentes não comprovam que os
            cadastros sejam diferentes.
          </p>
        )}
        {query.data?.map((c) => (
          <div className="space-y-2 rounded border p-3" key={c.candidate_id}>
            <Link
              to="/candidatos/$id"
              params={{ id: c.candidate_id }}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium underline"
            >
              Conferir {c.nome ?? "cadastro sem nome"}
            </Link>
            <p className="text-sm">
              {c.email ?? "E-mail não informado"} · {c.telefone ?? "Telefone não informado"}
            </p>
            <p className="text-sm">{c.reasons.join(" · ")}</p>
            {canAdmin && (
              <Button
                variant="outline"
                onClick={() => {
                  setTarget({ ...c, sourceVersion: candidate.review_version });
                  setConfirmed(false);
                  setReason("");
                }}
              >
                Conferi os dois cadastros: preparar união
              </Button>
            )}
          </div>
        ))}
        {selected && (
          <div className="space-y-3 rounded border border-amber-500 p-4">
            <p className="font-medium">
              Manter {selected.nome ?? "cadastro de destino"} e adicionar os documentos de{" "}
              {candidate.nome ?? "este cadastro"}
            </p>
            <p className="text-sm">
              O cadastro atual será arquivado. O destino manterá suas correções e seu currículo
              selecionado. Os dados anteriores ficarão no histórico. Confira identidade, contatos e
              originais antes de confirmar; coincidência de contato sozinha não basta.
            </p>
            <Textarea
              aria-label="Justificativa da união"
              placeholder="Como você confirmou que os documentos são da mesma pessoa?"
              maxLength={1000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              Conferi os dois cadastros e os documentos: pertencem à mesma pessoa.
            </label>
            <div className="flex gap-2">
              <Button
                disabled={!confirmed || reason.trim().length < 15 || merge.isPending}
                onClick={() => merge.mutate()}
              >
                Confirmar união dos documentos
              </Button>
              <Button variant="outline" onClick={() => setTarget(null)}>
                Cancelar
              </Button>
            </div>
          </div>
        )}
        {history.isError && <p role="alert">Não foi possível consultar o histórico de uniões.</p>}
        {history.data?.map((h) => (
          <details key={h.id} className="rounded border p-3 text-sm">
            <summary>Cadastro reunido em {new Date(h.created_at).toLocaleString("pt-BR")}</summary>
            <p>Responsável: {h.actor_id ?? "Conta removida"}</p>
            <p>Justificativa: {h.reason}</p>
            <details>
              <summary>Dados e correções preservados do cadastro anterior</summary>
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words">
                {JSON.stringify(
                  { cadastro: h.source_snapshot, revisoes: h.source_revisions },
                  null,
                  2,
                )}
              </pre>
            </details>
          </details>
        ))}
      </CardContent>
    </Card>
  );
}
