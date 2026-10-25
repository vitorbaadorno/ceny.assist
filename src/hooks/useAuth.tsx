import { useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { completeAuthRedirect, signOutVerified } from "@/lib/auth-security";

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  authError: string | null;
  recoverySession: boolean;
  signOut: () => Promise<void>;
};
const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  loading: true,
  authError: null,
  recoverySession: false,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const cache = useQueryClient();
  const lastUser = useRef<string | null>(null);
  const initialization = useRef<Promise<{ recovery: boolean; handled: boolean }> | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [recoverySession, setRecoverySession] = useState(false);
  const [logoutLocked, setLogoutLocked] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [logoutBusy, setLogoutBusy] = useState(false);

  useEffect(() => {
    let active = true;
    const { data: sub } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;
      if (lastUser.current !== (nextSession?.user.id ?? null) || event === "SIGNED_OUT") {
        void cache.cancelQueries();
        cache.clear();
        setRecoverySession(false);
      }
      lastUser.current = nextSession?.user.id ?? null;
      setSession(nextSession);
    });
    initialization.current ??= completeAuthRedirect(supabase.auth, window.location.href);
    void initialization.current
      .then(async (result) => {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!active) return;
        setSession(data.session);
        setRecoverySession(result.recovery && !!data.session);
        if (result.handled)
          window.history.replaceState(
            null,
            "",
            result.recovery ? "/reset-password" : window.location.pathname,
          );
      })
      .catch((error) => {
        if (!active) return;
        setAuthError(error instanceof Error ? error.message : "Não foi possível validar o acesso.");
        setRecoverySession(false);
        window.history.replaceState(null, "", window.location.pathname);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [cache]);

  async function signOut() {
    setLogoutLocked(true);
    setLogoutBusy(true);
    setLogoutError(null);
    setRecoverySession(false);
    await cache.cancelQueries();
    cache.clear();
    try {
      await signOutVerified(supabase.auth);
      setSession(null);
      setLogoutLocked(false);
    } catch (error) {
      setLogoutError(error instanceof Error ? error.message : "A saída não foi confirmada.");
      throw error;
    } finally {
      cache.clear();
      setLogoutBusy(false);
    }
  }
  return (
    <AuthContext.Provider
      value={{ session, user: session?.user ?? null, loading, authError, recoverySession, signOut }}
    >
      {logoutLocked ? (
        <main className="mx-auto max-w-lg space-y-4 p-10" role="status">
          <h1 className="text-xl font-semibold">Encerrando o acesso</h1>
          <p>{logoutError ?? "Confirmando a saída…"}</p>
          {logoutError && (
            <button
              className="rounded border p-3"
              disabled={logoutBusy}
              onClick={() => {
                void signOut().catch(() => {});
              }}
            >
              {logoutBusy ? "Aguarde…" : "Tentar sair novamente"}
            </button>
          )}
        </main>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  return useContext(AuthContext);
}
