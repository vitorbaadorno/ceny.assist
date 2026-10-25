import type { SupabaseClient } from "@supabase/supabase-js";

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_HELP =
  "Use pelo menos 12 caracteres, com maiúscula, minúscula, número e símbolo.";
export function passwordError(password: string, confirmation: string): string | null {
  if (password !== confirmation) return "As senhas não coincidem.";
  if (
    password.length < PASSWORD_MIN_LENGTH ||
    !/[a-z]/.test(password) ||
    !/[A-Z]/.test(password) ||
    !/[0-9]/.test(password) ||
    !/[!@#$%^&*()_+\-=\[\]{};'\\:"|<>?,./`~]/.test(password)
  )
    return PASSWORD_HELP;
  if (new TextEncoder().encode(password).length > 72)
    return "A senha deve ter no máximo 72 bytes. Reduza a quantidade de caracteres.";
  return null;
}

// An existing session must never turn an expired recovery link into a valid one.
export async function completeAuthRedirect(auth: SupabaseClient["auth"], href: string) {
  const url = new URL(href);
  const hash = new URLSearchParams(url.hash.slice(1));
  if (
    hash.has("error") ||
    hash.has("error_code") ||
    url.searchParams.has("error") ||
    url.searchParams.has("error_code")
  )
    throw new Error("O link é inválido, já foi utilizado ou expirou. Solicite um novo link.");
  const access_token = hash.get("access_token");
  const refresh_token = hash.get("refresh_token");
  if (!access_token && !refresh_token) return { recovery: false, handled: false };
  if (!access_token || !refresh_token) throw new Error("Link incompleto. Solicite um novo link.");
  const { data, error } = await auth.setSession({ access_token, refresh_token });
  if (error || !data.session)
    throw new Error("Não foi possível validar o link. Solicite um novo link.");
  const verified = await auth.getUser();
  if (verified.error || verified.data.user?.id !== data.session.user.id)
    throw new Error("Não foi possível confirmar a conta.");
  return { recovery: hash.get("type") === "recovery", handled: true };
}

export async function signOutVerified(auth: SupabaseClient["auth"]) {
  const { error } = await auth.signOut({ scope: "global" });
  if (error)
    throw new Error(
      "Não foi possível confirmar a saída no servidor. Verifique sua conexão e tente novamente.",
    );
  const result = await auth.getSession();
  if (result.error || result.data.session)
    throw new Error("A sessão ainda está ativa. Tente sair novamente.");
}
