import { requireCompanyRole } from "./access.ts";
import { callAiJson, type InputPart } from "./ai.ts";
import type { Json, WorkerContext } from "./context.ts";
import { z } from 'npm:zod@3.25.76';

const nullableText = z.string().nullable();
const validatedExtraction = z.object({
  nome_completo: nullableText, email: nullableText, telefone: nullableText,
  data_nascimento: z.string().date().nullable(), localizacao: nullableText,
  formacao_academica: z.array(z.object({ curso: nullableText, instituicao: nullableText, nivel: nullableText, periodo: nullableText }).strict()),
  experiencias: z.array(z.object({ empresa: nullableText, cargo: nullableText, periodo: nullableText, descricao: nullableText }).strict()),
  skills: z.array(z.string()), idiomas: z.array(z.string()), certificacoes: z.array(z.string()),
  anos_experiencia_total: z.number().finite().min(0).nullable(), confianca: z.number().min(0).max(1),
  campos_incertos: z.array(z.string()),
}).strict();
const extractionSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "nome_completo",
    "email",
    "telefone",
    "data_nascimento",
    "localizacao",
    "formacao_academica",
    "experiencias",
    "skills",
    "idiomas",
    "certificacoes",
    "anos_experiencia_total",
    "confianca",
    "campos_incertos",
  ],
  properties: {
    nome_completo: { type: ["string", "null"] },
    email: { type: ["string", "null"] },
    telefone: { type: ["string", "null"] },
    data_nascimento: { type: ["string", "null"], description: "Data no formato YYYY-MM-DD" },
    localizacao: { type: ["string", "null"] },
    formacao_academica: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["curso", "instituicao", "nivel", "periodo"],
        properties: {
          curso: { type: ["string", "null"] },
          instituicao: { type: ["string", "null"] },
          nivel: { type: ["string", "null"] },
          periodo: { type: ["string", "null"] },
        },
      },
    },
    experiencias: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["empresa", "cargo", "periodo", "descricao"],
        properties: {
          empresa: { type: ["string", "null"] },
          cargo: { type: ["string", "null"] },
          periodo: { type: ["string", "null"] },
          descricao: { type: ["string", "null"] },
        },
      },
    },
    skills: { type: "array", items: { type: "string" } },
    idiomas: { type: "array", items: { type: "string" } },
    certificacoes: { type: "array", items: { type: "string" } },
    anos_experiencia_total: { type: ["number", "null"] },
    confianca: { type: "number" },
    campos_incertos: { type: "array", items: { type: "string" } },
  },
} as const;

type Extraction = {
  nome_completo: string | null;
  email: string | null;
  telefone: string | null;
  data_nascimento: string | null;
  localizacao: string | null;
  formacao_academica: unknown[];
  experiencias: unknown[];
  skills: string[];
  idiomas: string[];
  certificacoes: string[];
  anos_experiencia_total: number | null;
  confianca: number;
  campos_incertos: string[];
};

function toBase64(bytes: Uint8Array) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export async function processResume(data: { companyId: string; candidateId: string }, context: WorkerContext) {
    const supabase = context.supabase;
    await requireCompanyRole(supabase, context.userId, data.companyId, ["owner", "admin", "recruiter"]);
    const supabaseAdmin = context.admin;

    const { data: candidate, error: loadError } = await supabase
      .from("candidates")
      .select("id, arquivo_original_path, arquivo_nome")
      .eq("company_id", data.companyId).eq("id", data.candidateId)
      .single();

    if (loadError || !candidate?.arquivo_original_path) {
      throw new Error("Currículo não encontrado.");
    }

    try {
      const { data: file, error: downloadError } = await supabase.storage
        .from("resumes")
        .download(candidate.arquivo_original_path);
      if (downloadError || !file) throw new Error("Não foi possível abrir o arquivo enviado.");

      const bytes = new Uint8Array(await file.arrayBuffer());
      if (bytes.length === 0) throw new Error("O arquivo enviado está vazio.");

      const filename = candidate.arquivo_nome ?? "curriculo";
      const mime = file.type || (filename.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg");
      const base64 = toBase64(bytes);
      const isImage = mime.startsWith("image/");

      const parts: InputPart[] = [
        {
          type: "input_text",
          text: "Extraia os dados estruturados deste currículo. Use null quando a informação não estiver presente. Para data de nascimento, use YYYY-MM-DD. Responda em português.",
        },
        isImage
          ? { type: "input_image", image_url: `data:${mime};base64,${base64}` }
          : { type: "input_file", filename, file_data: `data:${mime};base64,${base64}` },
      ];

      const extraction = validatedExtraction.parse(await callAiJson<Extraction>({
        instructions:
          "Você é um assistente de RH que lê currículos (inclusive digitalizados/fotografados) e extrai dados estruturados com precisão. Nunca invente dados. Em 'confianca' informe de 0 a 1 sua confiança geral e liste em 'campos_incertos' os campos duvidosos ou ausentes que sejam essenciais (nome, email, telefone).",
        parts,
        schemaName: "curriculo",
        schema: extractionSchema as unknown as Record<string, unknown>,
      }));

      const essenciaisFaltando =
        !extraction.nome_completo || (!extraction.email && !extraction.telefone);
      const needsReview = essenciaisFaltando || (extraction.confianca ?? 0) < 0.6;

      const { error: updateError } = await supabaseAdmin.rpc('save_candidate_extraction', {
        p_actor: context.userId, p_company: data.companyId, p_id: candidate.id,
        p_extraction: extraction as unknown as Json, p_status: needsReview ? "revisao_manual" : "concluido",
      });

      if (updateError) throw new Error(updateError.message);

      return { status: needsReview ? "revisao_manual" : "concluido" };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao processar o currículo.";
      await supabaseAdmin.rpc('save_candidate_extraction', {
        p_actor: context.userId, p_company: data.companyId, p_id: candidate.id,
        p_extraction: {}, p_status: 'erro', p_error: 'Não foi possível processar o currículo. Tente novamente.',
      });
      throw new Error(message);
    }
}
