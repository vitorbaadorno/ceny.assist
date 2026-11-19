export const AI_MINIMIZATION_VERSION = "resume-professional-text-v2";
export class AiPrivacyPending extends Error {
  override name = "AiPrivacyPending";
}

// Conservative reduction, not anonymization. Preserve paragraph positions for evidence.
// No original filename, binary file, image, URL or account identity is sent to the model.
export function minimizeResumeText(text: string) {
  const sections =
    /^(?:resumo|perfil profissional|objetivo|experi[eê]ncia|forma[çc][aã]o|educa[çc][aã]o|compet[eê]ncias|habilidades|qualifica[çc][oõ]es|cursos|certifica[çc][oõ]es|idiomas|projetos|professional|summary|experience|education|skills|projects|qualifications|languages|certifications|experiencia|formaci[oó]n|habilidades|idiomas)\b/i;
  let professional = false;
  return text
    .split("\n")
    .map((line) => {
      // Recognizable professional prose may precede a conventional heading.
      // Unknown introductory lines remain omitted; this is not anonymization.
      if (
        sections.test(line.trim()) ||
        /^(?:analista|engenheir[oa]|desenvolvedor[ae]?|técnic[oa]|profissional|enfermeir[oa]|professor[ae]?|atuei|desenvolvi|coordenei|implementei|trabalhei)\b/i.test(
          line.trim(),
        )
      )
        professional = true;
      if (!professional) return "[identificação inicial omitida]";
      if (
        /^(?:\s*(?:nome|name|cpf|cnpj|rg|passaporte|passport|(?:data de )?nascimento|(?:date of )?birth|idade|age|endere[çc]o|address|rua|avenida|cep|estado civil|marital|filhos|religi[aã]o|religion|ra[çc]a|racial|etnia|ethnic|defici[eê]ncia|disability|diagn[oó]stico|diagnosis|sa[uú]de|health|orienta[çc][aã]o sexual|g[eê]nero|gender)\s*[:=]|\s*(?:cpf|rg|cep|idade)\s+\d)|\b(?:tenho\s+\d{1,3}\s+anos|nasci em|sou portador|fui diagnosticad[oa])\b/i.test(
          line,
        )
      )
        return "[informação pessoal omitida]";
      return line
        .replace(/[\w.+%-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[contato omitido]")
        .replace(/(?:https?:\/\/|www\.)\S+/gi, "[link omitido]")
        .replace(/(?:\+\d{1,3}[\s-]?)?(?:\(?\d{2,3}\)?[\s-]?)?\d{4,5}[\s-]\d{4}\b/g, (value) =>
          /^(?:19|20)\d{2}-(?:19|20)\d{2}$/.test(value) ? value : "[telefone omitido]",
        )
        .replace(/\b\d{9,14}\b/g, "[identificador omitido]")
        .replace(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, "[identificador omitido]");
    })
    .join("\n");
}

export function requireAiPrivacyReview(reference: string | undefined) {
  if (!reference?.trim())
    throw new AiPrivacyPending(
      "O envio à IA depende da validação do fornecedor e do tratamento de dados. Faça a revisão manual enquanto essa pendência não for resolvida.",
    );
}

export function prepareProfessionalText(source: { text?: string }) {
  if (!source.text)
    throw new AiPrivacyPending(
      "Este formato exige leitura do arquivo integral. O envio de PDFs e imagens à IA está suspenso até haver minimização e validação específicas; use a revisão manual.",
    );
  const text = minimizeResumeText(source.text);
  if (!text.replace(/\[[^\]]*\]/g, "").trim())
    throw new AiPrivacyPending(
      "Não foi possível separar com segurança o conteúdo profissional. Faça a revisão manual.",
    );
  return text;
}
