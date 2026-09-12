import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound } from "lucide-react";

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
  const [checking, setChecking] = useState(true);
  const [validRecovery, setValidRecovery] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    const hashRecovery = new URLSearchParams(window.location.hash.slice(1)).get("type") === "recovery";
    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY" || (hashRecovery && session)) setValidRecovery(true);
      setChecking(false);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setValidRecovery(hashRecovery && Boolean(data.session));
      setChecking(false);
    });
    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (password !== confirmation) {
      toast.error("As senhas não coincidem.");
      return;
    }
    if (password.length < 8) {
      toast.error("A senha deve ter pelo menos 8 caracteres.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      toast.error(error.message);
      setBusy(false);
      return;
    }
    await supabase.auth.signOut();
    toast.success("Senha redefinida. Entre com a nova senha.");
    navigate({ to: "/auth" });
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
            <CardDescription>Use pelo menos 8 caracteres.</CardDescription>
          </CardHeader>
          <CardContent>
            {checking ? (
              <p className="text-sm text-muted-foreground">Validando link...</p>
            ) : !validRecovery ? (
              <div className="space-y-4">
                <p className="text-sm text-destructive">Este link é inválido ou expirou.</p>
                <Button asChild variant="outline" className="w-full">
                  <Link to="/auth">Solicitar um novo link</Link>
                </Button>
              </div>
            ) : (
              <form className="space-y-4" onSubmit={submit}>
                <div className="space-y-2">
                  <Label htmlFor="new-password">Nova senha</Label>
                  <Input id="new-password" type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirmar nova senha</Label>
                  <Input id="confirm-password" type="password" minLength={8} value={confirmation} onChange={(e) => setConfirmation(e.target.value)} required />
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