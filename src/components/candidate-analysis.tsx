import { analysisView } from "@/lib/analysis-view";
import type { Json } from "@/integrations/supabase/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const fieldName = (field: string) =>
  field
    .replaceAll("nome_completo", "Nome")
    .replaceAll("data_nascimento", "Nascimento")
    .replaceAll("formacao_academica", "Formação")
    .replaceAll("experiencias", "Experiências")
    .replaceAll("resumo_profissional", "Resumo")
    .replaceAll("skills", "Competências")
    .replaceAll("_", " ");
export function CandidateAnalysis({ value }: { value: Json }) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    value["schema_version"] !== "2"
  )
    return (
      <p className="text-xs text-muted-foreground">
        Esta leitura é anterior à conferência por evidências. Reprocesse o original para obter o
        novo relatório.
      </p>
    );
  const parsed = analysisView.safeParse(value);
  if (!parsed.success)
    return (
      <p role="alert">
        A leitura contém campos incompatíveis. Confira o original ou solicite uma nova análise.
      </p>
    );
  const data = parsed.data;
  const summary = data.resumo_profissional;
  return (
    <div className="space-y-4">
      {(data.pontos_esclarecer.length > 0 || data.perguntas_entrevista.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Esclarecimentos e entrevista</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Sugestões da IA para conferência do RH</p>
            <ul>
              {data.pontos_esclarecer.map((v, i) => (
                <li key={"gap" + i}>{v}</li>
              ))}
            </ul>
            <ol>
              {data.perguntas_entrevista.map((v, i) => (
                <li key={"question" + i}>{v}</li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Resumo profissional</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="text-muted-foreground">
            Síntese interpretada pela IA a partir do currículo. Confira os fatos e as evidências
            abaixo.
          </p>
          <p className="font-medium">{summary?.titulo ?? "Título não informado"}</p>
          <p>{summary?.sintese ?? "Resumo não informado"}</p>
          <p>Áreas: {summary?.areas.join(", ") || "Não informadas"}</p>
          <p>Senioridade sugerida: {summary?.senioridade ?? "Não informada"}</p>
        </CardContent>
      </Card>
      {(data.pontos_esclarecer.length > 0 || data.perguntas_entrevista.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Esclarecimentos e entrevista</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Sugestões da IA para conferência do RH</p>
            <ul>
              {data.pontos_esclarecer.map((v, i) => (
                <li key={"gap" + i}>{v}</li>
              ))}
            </ul>
            <ol>
              {data.perguntas_entrevista.map((v, i) => (
                <li key={"question" + i}>{v}</li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Projetos relevantes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {!data.projetos?.length && <p>Não informados no currículo.</p>}
          {data.projetos?.map((project, i) => (
            <div key={i} className="border-b pb-2">
              <p className="font-medium">{project.nome ?? "Nome não informado"}</p>
              <p>{project.descricao}</p>
              <p>{project.periodo ?? "Período não informado"}</p>
              <p>{project.tecnologias.join(", ")}</p>
              {project.url && <p className="break-all">Referência no currículo: {project.url}</p>}
            </div>
          ))}
        </CardContent>
      </Card>
      {(data.pontos_esclarecer.length > 0 || data.perguntas_entrevista.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Esclarecimentos e entrevista</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Sugestões da IA para conferência do RH</p>
            <ul>
              {data.pontos_esclarecer.map((v, i) => (
                <li key={"gap" + i}>{v}</li>
              ))}
            </ul>
            <ol>
              {data.perguntas_entrevista.map((v, i) => (
                <li key={"question" + i}>{v}</li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Conferência da leitura</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {!!data.controle_qualidade?.motivos_revisao.length && (
            <div role="status">
              <p className="font-medium">Revisão humana necessária</p>
              <ul className="list-disc pl-5">
                {data.controle_qualidade.motivos_revisao.map((reason) => (
                  <li key={reason}>{fieldName(reason)}</li>
                ))}
              </ul>
            </div>
          )}
          <p>
            Cobertura de evidências:{" "}
            {Math.round((data.controle_qualidade?.cobertura_evidencias ?? 0) * 100)}%. Isso mede
            quantos campos possuem referência, não a precisão da leitura.
          </p>
          <p>
            A precisão deste currículo ainda não foi medida contra uma conferência humana. A
            confiança da IA não substitui essa medição.
          </p>
          {data.experiencia_calculada && (
            <p>
              Experiência: {data.experiencia_calculada.meses_confirmados ?? "Não informada"}
              {data.experiencia_calculada.meses_confirmados !== null
                ? " meses identificados, sem contar sobreposições"
                : ""}
              .{" "}
              {data.experiencia_calculada.completa
                ? "Todos os períodos possuem mês de início e fim."
                : "Há períodos ausentes ou imprecisos; o total em anos permanece não informado."}{" "}
              Referência: {data.experiencia_calculada.referencia}.
            </p>
          )}
          <details>
            <summary className="cursor-pointer font-medium">
              Trechos que sustentam as informações
            </summary>
            <div className="mt-3 space-y-3">
              {data.evidencias?.map((e, i) => (
                <div className="rounded border p-3" key={i}>
                  <p className="font-medium">
                    {fieldName(e.campo)} ·{" "}
                    {e.tipo === "encontrado" ? "Informação encontrada" : "Interpretação da IA"}
                  </p>
                  <p>
                    {e.pagina
                      ? `Página ${e.pagina}`
                      : e.paragrafo
                        ? `Parágrafo ${e.paragrafo}`
                        : "Localização não informada"}
                  </p>
                  <blockquote className="mt-1 border-l-2 pl-3">{e.trecho}</blockquote>
                  <p className="mt-1 text-muted-foreground">
                    {e.verificacao === "trecho_conferido"
                      ? "Trecho localizado no texto do DOCX; confira se sustenta o campo."
                      : e.verificacao === "inconsistente"
                        ? "Referência inconsistente: conferir no original."
                        : "Referência indicada pela IA; conferir no original."}
                  </p>
                </div>
              ))}
            </div>
          </details>
        </CardContent>
      </Card>
    </div>
  );
}
