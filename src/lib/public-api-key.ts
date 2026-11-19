export function assertPublicApiKey(key: string) {
  if (key.startsWith("sb_publishable_") && key.trim() === key) return;
  if (key.split(".").length === 3) {
    try {
      const payload = JSON.parse(
        atob(key.split(".")[1]!.replaceAll("-", "+").replaceAll("_", "/")),
      );
      if (payload.role === "anon") return;
    } catch {
      /* Never include a supplied key in diagnostics. */
    }
  }
  throw new Error("Configure somente a chave publicável do Supabase nesta aplicação.");
}
