import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function MfaChallenge({
  factorId,
  onVerified,
}: {
  factorId: string;
  onVerified: () => void;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      className="space-y-3"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError("");
        try {
          const result = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
          if (result.error) throw new Error();
          setCode("");
          onVerified();
        } catch {
          setError("Código não confirmado. Confira o autenticador e tente novamente.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="block">
        Código do autenticador
        <Input
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
        />
      </label>
      {error && <p role="alert">{error}</p>}
      <Button disabled={busy || !/^\d{6}$/.test(code)}>
        {busy ? "Verificando…" : "Verificar segundo fator"}
      </Button>
    </form>
  );
}

export function MfaGate({ children }: { children: ReactNode }) {
  const { session, signOut } = useAuth();
  const [state, setState] = useState<{ token: string; factor?: string; error?: boolean }>();
  useEffect(() => {
    let active = true;
    if (!session) return;
    const token = session.access_token;
    void (async () => {
      const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assurance.error) throw new Error();
      if (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2") {
        const factors = await supabase.auth.mfa.listFactors();
        const id = factors.data?.totp[0]?.id;
        if (factors.error || !id) throw new Error();
        if (active) setState({ token, factor: id });
      } else if (active) setState({ token });
    })().catch(() => {
      if (active) setState({ token, error: true });
    });
    return () => {
      active = false;
    };
  }, [session]);
  if (!session) return children;
  if (state?.token !== session.access_token)
    return <p role="status">Verificando segurança da sessão…</p>;
  if (state.error || state.factor)
    return (
      <main className="mx-auto max-w-lg space-y-4 p-8">
        <h1 className="text-xl font-semibold">Verificar acesso</h1>
        {state.factor ? (
          <MfaChallenge factorId={state.factor} onVerified={() => window.location.reload()} />
        ) : (
          <p role="alert">Não foi possível verificar a sessão. Entre novamente.</p>
        )}
        <p>
          Se perdeu o autenticador, procure o responsável pelo acesso. A recuperação exige
          verificação de identidade.
        </p>
        <Button
          variant="outline"
          onClick={() => {
            void signOut().catch(() => {});
          }}
        >
          Sair
        </Button>
      </main>
    );
  return children;
}

export function MfaSettings() {
  const [enrollment, setEnrollment] = useState<{ id: string; qr: string }>();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <section className="space-y-3 rounded border p-4">
      <h2 className="font-semibold">Autenticação em dois fatores</h2>
      <p>
        Prepare o autenticador e sua cópia de recuperação em local protegido. A ativação exige
        conferir o código. Não compartilhe o QR code.
      </p>
      {message && <p role="status">{message}</p>}
      {enrollment ? (
        <>
          <img
            alt="QR code para cadastrar o autenticador"
            src={enrollment.qr}
            className="h-48 w-48"
          />
          <MfaChallenge
            factorId={enrollment.id}
            onVerified={() => {
              setEnrollment(undefined);
              setMessage("Segundo fator confirmado. Novos acessos exigirão o autenticador.");
            }}
          />
        </>
      ) : (
        <Button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setMessage("");
            try {
              const factors = await supabase.auth.mfa.listFactors();
              if (factors.error) throw new Error();
              if (factors.data.totp.length) {
                setMessage("Você já possui autenticador confirmado.");
                return;
              }
              // Remove only this user's abandoned TOTP enrollment, never a verified factor.
              for (const f of factors.data.all.filter(
                (f) => f.factor_type === "totp" && f.status === "unverified",
              )) {
                const removed = await supabase.auth.mfa.unenroll({ factorId: f.id });
                if (removed.error) throw new Error();
              }
              const result = await supabase.auth.mfa.enroll({
                factorType: "totp",
                friendlyName: "Ceny Assist",
              });
              if (result.error) throw new Error();
              setEnrollment({ id: result.data.id, qr: result.data.totp.qr_code });
            } catch {
              setMessage(
                "Não foi possível preparar o autenticador. Entre novamente e tente outra vez.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          Configurar autenticador
        </Button>
      )}
    </section>
  );
}
