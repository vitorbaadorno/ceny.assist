export const APPRENTICE_RULE_VERSION = "br-clt-428-preliminary-v1";
export const AGE_TIME_ZONE = "America/Sao_Paulo";

/** Civil date in the explicitly chosen business time zone, independent of the device. */
export function ageReferenceDate(instant: Date = new Date()): string {
  if (!Number.isFinite(instant.getTime())) throw new Error("Data de referência inválida.");
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: AGE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function isCivilDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year = 0, month = 0, day = 0] = value.split("-").map(Number);
  if (year < 1900 || month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]!;
}
export function calculateAge(
  dateOfBirth: string | null | undefined,
  reference: string | Date = new Date(),
) {
  const date = reference instanceof Date ? ageReferenceDate(reference) : reference;
  if (!dateOfBirth || !isCivilDate(dateOfBirth) || !isCivilDate(date) || dateOfBirth > date)
    return null;
  return (
    Number(date.slice(0, 4)) -
    Number(dateOfBirth.slice(0, 4)) -
    (date.slice(5) < dateOfBirth.slice(5) ? 1 : 0)
  );
}
export type ApprenticeAgeAssessment = {
  rule_version: typeof APPRENTICE_RULE_VERSION;
  reference_date: string;
  reference_basis: "analysis_date_sao_paulo";
  legal_validation: "pending";
  age: number | null;
  state: "birth_date_pending" | "invalid_birth_date" | "general_range" | "special_review";
};
/** Advisory only: never determines hiring eligibility, score or inclusion in a ranking. */
export function assessApprenticeAge(
  dateOfBirth: string | null | undefined,
  reference: string,
): ApprenticeAgeAssessment {
  if (!isCivilDate(reference)) throw new Error("Data de referência inválida.");
  const age = calculateAge(dateOfBirth, reference);
  return {
    rule_version: APPRENTICE_RULE_VERSION,
    reference_date: reference,
    reference_basis: "analysis_date_sao_paulo",
    legal_validation: "pending",
    age,
    state: !dateOfBirth
      ? "birth_date_pending"
      : age === null
        ? "invalid_birth_date"
        : age >= 14 && age < 24
          ? "general_range"
          : "special_review",
  };
}
export const apprenticeAgeMessages: Record<ApprenticeAgeAssessment["state"], string> = {
  birth_date_pending:
    "Data de nascimento não informada: pendente de conferência. O candidato foi mantido.",
  invalid_birth_date:
    "Data de nascimento inválida ou posterior à referência: confira o cadastro. O candidato foi mantido.",
  general_range:
    "Dentro da faixa etária geral para conferência preliminar; isso não confirma a elegibilidade contratual.",
  special_review:
    "Fora da faixa etária geral nesta referência: exige conferência autorizada das regras e eventuais exceções. Sem exclusão automática.",
};
