// Backend configuration. A different paid model requires only a secret change.
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
        "ValidaÃƒÂ§ÃƒÂ£o de tratamento de dados e serviÃƒÂ§o pago do Gemini pendente. Utilize a revisÃƒÂ£o manual.",
      ),
      { name: "AiPrivacyPending" },
    );
}
