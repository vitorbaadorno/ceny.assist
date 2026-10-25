import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck } from "lucide-react";
import { PASSWORD_HELP, PASSWORD_MIN_LENGTH, passwordError } from "@/lib/auth-security";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar | Triagem de Currículos" },
      {
        name: "description",
        content:
          "Acesso restrito à equipe de RH para gerenciar candidatos, vagas e a triagem automática de currículos.",
      },
      { property: "og:title", content: "Entrar | Triagem de Currículos" },
      {
        property: "og:description",
        content: "Acesso restrito à equipe de RH do sistema de triagem de currículos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const [mode, setMode] = useState<"signin" | "signup" | "recovery" | "confirm">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [nome, setNome] = useState("");
  const [busy, setBusy] = useState(false);
  const { session, loading, authError, recoverySession } = useAuth();
  const navigate = useNavigate();
  const router = useRouter();

  useEffect(() => {
    if (!loading && session && !authError)
      navigate({ to: recoverySession ? "/reset-password" : "/" });
  }, [loading, session, navigate, authError, recoverySession]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      if (mode === "confirm") {
        const { error } = await supabase.auth.resend({
          type: "signup",
          email,
          options: { emailRedirectTo: `${window.location.origin}/auth` },
        });
        if (error) throw error;
        toast.success("Se houver uma conta pendente, você receberá um novo link de confirmação.");
      } else if (mode === "recovery") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success(
          "Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha.",
        );
      } else if (mode === "signup") {
        const invalid = passwordError(password, confirmation);
        if (invalid) throw new Error(invalid);
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth`,
            data: { full_name: nome },
          },
        });
        if (error) throw error;
        toast.success("Conta criada! Verifique seu e-mail para confirmar o acesso.");
        setPassword("");
        setConfirmation("");
        setMode("confirm");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await router.invalidate();
        navigate({ to: "/" });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível entrar.");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) toast.error("Google não configurado nesta conta. Entre com e-mail e senha.");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-secondary px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <ShieldCheck className="size-6" />
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">Triagem de Currículos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Área restrita à equipe de RH. Dados de candidatos com acesso autorizado por empresa.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              {mode === "signin"
                ? "Entrar"
                : mode === "signup"
                  ? "Criar conta"
                  : mode === "confirm"
                    ? "Confirmar e-mail"
                    : "Recuperar senha"}
            </CardTitle>
            <CardDescription>
              {mode === "signin"
                ? "Use seu e-mail corporativo para acessar o sistema."
                : mode === "signup"
                  ? "Cadastre um novo usuário da equipe de RH."
                  : mode === "confirm"
                    ? "Confirme seu e-mail para configurar sua empresa ou aceitar um convite."
                    : "Informe seu e-mail para receber o link de redefinição."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {authError && (
              <p role="alert" className="text-sm text-destructive">
                {authError}
              </p>
            )}
            <form className="space-y-4" onSubmit={handleSubmit}>
              {mode === "signup" && (
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome completo</Label>
                  <Input
                    id="nome"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    required
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              {(mode === "signin" || mode === "signup") && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="password">Senha</Label>
                    {mode === "signin" && (
                      <Button
                        type="button"
                        variant="link"
                        className="h-auto p-0 text-xs"
                        onClick={() => setMode("recovery")}
                      >
                        Esqueci minha senha
                      </Button>
                    )}
                  </div>
                  <Input
                    id="password"
                    type="password"
                    minLength={mode === "signup" ? PASSWORD_MIN_LENGTH : undefined}
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              )}
              {mode === "signup" && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">{PASSWORD_HELP}</p>
                  <Label htmlFor="confirmation">Confirmar senha</Label>
                  <Input
                    id="confirmation"
                    type="password"
                    autoComplete="new-password"
                    value={confirmation}
                    onChange={(e) => setConfirmation(e.target.value)}
                    required
                  />
                  <p className="text-sm text-muted-foreground">
                    Criar uma conta não libera dados de outras empresas. Você precisará de um
                    convite.
                  </p>
                </div>
              )}
              <Button type="submit" className="w-full" disabled={busy || loading}>
                {busy
                  ? "Aguarde..."
                  : mode === "signin"
                    ? "Entrar"
                    : mode === "signup"
                      ? "Criar conta"
                      : mode === "confirm"
                        ? "Reenviar confirmação"
                        : "Enviar link"}
              </Button>
            </form>

            {mode === "signin" && (
              <>
                <div className="relative py-1 text-center text-xs text-muted-foreground">
                  <span className="bg-card px-2">ou</span>
                  <div className="absolute inset-x-0 top-1/2 -z-10 h-px bg-border" />
                </div>
                <Button type="button" variant="outline" className="w-full" onClick={handleGoogle}>
                  Continuar com Google
                </Button>
              </>
            )}

            <Button
              type="button"
              variant="link"
              className="w-full text-muted-foreground"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            >
              {mode === "signin" ? "Não tem conta? Criar acesso" : "Voltar para entrar"}
            </Button>
            {mode === "signin" && (
              <Button
                type="button"
                variant="link"
                className="w-full"
                onClick={() => setMode("confirm")}
              >
                Não recebi a confirmação de e-mail
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
