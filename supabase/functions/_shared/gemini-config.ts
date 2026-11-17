// Backend only. Free quota is restricted to the fixed synthetic health probe.
export const MODEL =
  (typeof Deno !== "undefined" ? Deno.env.get("GEMINI_MODEL") : undefined) ?? "gemini-2.5-flash";
export const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/";
export function requireGeminiPrivacy() {
  if (
    Deno.env.get("CENY_GEMINI_DATA_TIER") !== "paid" ||
    !Deno.env.get("CENY_GEMINI_PRIVACY_REVIEW_REFERENCE")?.trim()
  )
    throw Object.assign(
      new Error(
        "Validação de tratamento de dados e serviço pago do Gemini pendente. Utilize a revisão manual.",
      ),
      { name: "AiPrivacyPending" },
    );
}
