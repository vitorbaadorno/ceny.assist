import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { PASSWORD_HELP, PASSWORD_MIN_LENGTH, passwordError } from "@/lib/auth-security";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Redefinir senha | Triagem de Currículos" },
      { name: "description", content: "Defina uma nova senha para acessar o sistema de triagem." },
      { property: "og:title", content: "Redefinir senha | Triagem de Currículos" },
      { property: "og:description", content: "Defina uma nova senha para sua conta." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const { loading: checking, recoverySession: validRecovery, authError, signOut } = useAuth();
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const invalid = passwordError(password, confirmation);
    if (invalid) {
      toast.error(invalid);
      return;
    }
    if (!validRecovery) {
      toast.error("Solicite um novo link de recuperação.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      toast.error(error.message);
      setBusy(false);
      return;
    }
    try {
      await signOut();
      toast.success("Senha redefinida. Entre com a nova senha.");
      navigate({ to: "/auth" });
    } catch {
      /* AuthProvider keeps the data hidden and offers a sign-out retry. */
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-secondary px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <KeyRound className="size-6" />
          </div>
          <h1 className="mt-4 text-2xl font-semibold">Redefinir senha</h1>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Crie uma nova senha</CardTitle>
            <CardDescription>{PASSWORD_HELP}</CardDescription>
          </CardHeader>
          <CardContent>
            {checking ? (
              <p className="text-sm text-muted-foreground">Validando link...</p>
            ) : !validRecovery ? (
              <div className="space-y-4">
                <p className="text-sm text-destructive">
                  {authError ?? "Este link é inválido, já foi utilizado ou expirou."}
                </p>
                <Button asChild variant="outline" className="w-full">
                  <Link to="/auth">Solicitar um novo link</Link>
                </Button>
              </div>
            ) : (
              <form className="space-y-4" onSubmit={submit}>
                <div className="space-y-2">
                  <Label htmlFor="new-password">Nova senha</Label>
                  <Input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    minLength={PASSWORD_MIN_LENGTH}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirmar nova senha</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    minLength={PASSWORD_MIN_LENGTH}
                    value={confirmation}
                    onChange={(e) => setConfirmation(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Salvando..." : "Salvar nova senha"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
