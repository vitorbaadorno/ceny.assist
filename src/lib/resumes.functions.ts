import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callAiJson, type InputPart } from "@/lib/ai.server";

const extractionSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "nome_completo",
    "email",
    "telefone",
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

export const processResume = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ candidateId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;

    const { data: candidate, error: loadError } = await supabase
      .from("candidates")
      .select("id, arquivo_original_path, arquivo_nome")
      .eq("id", data.candidateId)
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
          text: "Extraia os dados estruturados deste currículo. Use null quando a informação não estiver presente. Responda em português.",
        },
        isImage
          ? { type: "input_image", image_url: `data:${mime};base64,${base64}` }
          : { type: "input_file", filename, file_data: `data:${mime};base64,${base64}` },
      ];

      const extraction = await callAiJson<Extraction>({
        instructions:
          "Você é um assistente de RH que lê currículos (inclusive digitalizados/fotografados) e extrai dados estruturados com precisão. Nunca invente dados. Em 'confianca' informe de 0 a 1 sua confiança geral e liste em 'campos_incertos' os campos duvidosos ou ausentes que sejam essenciais (nome, email, telefone).",
        parts,
        schemaName: "curriculo",
        schema: extractionSchema as unknown as Record<string, unknown>,
      });

      const essenciaisFaltando =
        !extraction.nome_completo || (!extraction.email && !extraction.telefone);
      const needsReview = essenciaisFaltando || (extraction.confianca ?? 0) < 0.6;

      const { error: updateError } = await supabase
        .from("candidates")
        .update({
          nome: extraction.nome_completo ?? candidate.arquivo_nome ?? "Sem nome",
          email: extraction.email,
          telefone: extraction.telefone,
          localizacao: extraction.localizacao,
          skills: extraction.skills ?? [],
          anos_experiencia: extraction.anos_experiencia_total,
          dados_extraidos: extraction as unknown as Record<string, unknown>,
          processing_status: needsReview ? "revisao_manual" : "concluido",
          processing_error: null,
        })
        .eq("id", candidate.id);

      if (updateError) throw new Error(updateError.message);

      return { status: needsReview ? "revisao_manual" : "concluido" };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao processar o currículo.";
      await supabase
        .from("candidates")
        .update({ processing_status: "erro", processing_error: message })
        .eq("id", candidate.id);
      throw new Error(message);
    }
  });

export const getResumeUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ path: z.string().min(1) }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: signed, error } = await context.supabase.storage
      .from("resumes")
      .createSignedUrl(data.path, 60 * 10);
    if (error || !signed) throw new Error("Não foi possível gerar o link do currículo.");
    return { url: signed.signedUrl };
  });
