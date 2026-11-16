import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CompanyOperations } from "./company-operations";
import { Label } from "@/components/ui/label";

const roles: Record<string, string> = {
  owner: "Responsável pela empresa",
  admin: "Administrador",
  recruiter: "Profissional de RH",
  viewer: "Gestor — somente consulta",
};
const inputStyle = "rounded border bg-background p-2 text-sm";

export function CompanySettings() {
  const { companyId, role, canAdmin, selectCompany } = useCompany();
  const { user } = useAuth();
  const cache = useQueryClient();
  const [name, setName] = useState("");
  const [responsible, setResponsible] = useState(user?.user_metadata?.["full_name"] ?? "");
  const [email, setEmail] = useState("");
  const [memberRole, setMemberRole] = useState("recruiter");
  const [busy, setBusy] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [issuedCode, setIssuedCode] = useState("");
  const [password, setPassword] = useState("");
  const [recoveryConsent, setRecoveryConsent] = useState(false);
  const team = useQuery({
    queryKey: ["company-members", companyId],
    enabled: !!companyId && canAdmin,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase
        .from("company_members")
        .select("user_id, role")
        .eq("company_id", companyId)
        .abortSignal(signal);
      if (error) throw error;
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in(
          "id",
          data.map((m) => m.user_id),
        )
        .abortSignal(signal);
      if (profileError) throw profileError;
      return data.map((m) => ({ ...m, name: profiles.find((p) => p.id === m.user_id)?.full_name }));
    },
  });
  const pending = useQuery({
    queryKey: ["company-invitations", companyId],
    enabled: !!companyId && canAdmin,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase
        .from("company_invitations")
        .select("id,email,role,expires_at")
        .eq("company_id", companyId)
        .is("accepted_at", null)
        .is("revoked_at", null)
        .abortSignal(signal);
      if (error) throw error;
      return data;
    },
  });
  const inbox = useQuery({
    queryKey: ["my-invitations", user?.id],
    enabled: !!user,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase.rpc("my_company_invitations").abortSignal(signal);
      if (error) throw error;
      return data;
    },
    refetchInterval: 15000,
  });
  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    try {
      await action();
    } catch (error) {
      toast.error(
        error && typeof error === "object" && "message" in error
          ? String(error.message)
          : "Não foi possível concluir a operação.",
      );
    } finally {
      setBusy(false);
      setPassword("");
    }
  }
  async function refreshAccess() {
    await cache.invalidateQueries();
  }
  async function manageMember(id: string, newRole: string | null) {
    await run(async () => {
      const { error } = await supabase.rpc("manage_company_member", {
        p_company: companyId,
        p_user: id,
        p_role: newRole,
      });
      if (error) throw error;
      await refreshAccess();
      toast.success(newRole ? "Função atualizada." : "Acesso retirado.");
    });
  }
  async function reauthenticate() {
    if (!user?.email || !password) throw new Error("Confirme sua senha atual para continuar.");
    const { data, error } = await supabase.auth.signInWithPassword({ email: user.email, password });
    if (error || data.user?.id !== user.id)
      throw new Error("Não foi possível confirmar sua identidade.");
  }
  return (
    <section className="mx-auto max-w-3xl space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Configurações da empresa</h1>
        <p className="text-sm text-muted-foreground">
          Configure sua empresa, aceite convites e gerencie as permissões da equipe.
        </p>
      </header>
      {companyId && canAdmin && <CompanyOperations key={companyId} companyId={companyId} />}
      {companyId && canAdmin && (
        <ProductQuality key={`quality-${companyId}`} companyId={companyId} />
      )}
      {!companyId && (
        <p className="rounded border p-4">
          Você ainda não selecionou uma empresa com acesso ativo. Aceite um convite ou cadastre a
          empresa pela qual é responsável.
        </p>
      )}
      <section className="space-y-3 rounded-lg border p-5">
        <h2 className="font-semibold">Seus convites</h2>
        <p className="text-sm text-muted-foreground">
          Os convites aparecem para o e-mail confirmado da sua conta: {user?.email}.
        </p>
        {inbox.error && <p role="alert">Não foi possível consultar os convites.</p>}
        {inbox.isLoading ? (
          <p>Consultando…</p>
        ) : (
          !inbox.data?.length && <p className="text-sm">Nenhum convite disponível.</p>
        )}
        {inbox.data?.map((inv) => (
          <div
            className="flex flex-wrap items-center justify-between gap-3 rounded border p-3"
            key={inv.id}
          >
            <div>
              <p>{inv.company_name}</p>
              <p className="text-sm text-muted-foreground">
                {roles[inv.role]} · Expira em {new Date(inv.expires_at).toLocaleDateString("pt-BR")}
              </p>
            </div>
            <Button
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const { data, error } = await supabase.rpc("accept_company_invitation", {
                    p_id: inv.id,
                  });
                  if (error) throw error;
                  await refreshAccess();
                  await selectCompany(data);
                  toast.success("Convite aceito.");
                })
              }
            >
              Aceitar convite
            </Button>
          </div>
        ))}
      </section>
      <form
        className="space-y-3 rounded-lg border p-5"
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            const { data, error } = await supabase.rpc("create_company", {
              p_name: name,
              p_responsible: responsible,
            });
            if (error) throw error;
            await refreshAccess();
            await selectCompany(data);
            toast.success("Empresa configurada.");
          });
        }}
      >
        <h2 className="font-semibold">
          {companyId ? "Cadastrar outra empresa" : "Primeiro acesso — configurar empresa"}
        </h2>
        <Label htmlFor="company-name">Nome da empresa</Label>
        <Input
          id="company-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          minLength={2}
          maxLength={160}
          required
        />
        <Label htmlFor="responsible">Nome completo do responsável</Label>
        <Input
          id="responsible"
          value={responsible}
          onChange={(e) => setResponsible(e.target.value)}
          minLength={2}
          maxLength={160}
          required
        />
        <p className="text-sm text-muted-foreground">
          Sua conta será a responsável inicial. Empresas existentes exigem convite de um
          administrador.
        </p>
        <Button disabled={busy}>Criar empresa</Button>
      </form>
      {companyId && (
        <section className="space-y-3 rounded-lg border p-5">
          <h2 className="font-semibold">Permissões</h2>
          <p>Sua função: {roles[role]}</p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="p-2">Operação</th>
                  <th>Administrador</th>
                  <th>RH</th>
                  <th>Gestor</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Consultar candidatos, vagas e currículos", "Sim", "Sim", "Sim"],
                  ["Enviar, corrigir e avaliar candidatos", "Sim", "Sim", "Não"],
                  ["Convidar RH/gestor e gerenciar seus acessos", "Sim", "Não", "Não"],
                  ["Arquivar informações", "Sim", "Não", "Não"],
                ].map((row) => (
                  <tr key={row[0]}>
                    {row.map((cell, i) => (
                      <td className="border-t p-2" key={i}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-muted-foreground">
            O responsável também pode gerenciar administradores e configurar a recuperação.
            Pontuações automáticas não podem ser editadas diretamente. A exclusão nas telas arquiva
            o registro e retira seu acesso.
          </p>
        </section>
      )}
      {canAdmin && companyId && (
        <section className="space-y-5 rounded-lg border p-5">
          <h2 className="font-semibold">Equipe da empresa</h2>
          {team.error && <p role="alert">Não foi possível consultar a equipe.</p>}
          {team.data?.map((member) => {
            const editable =
              member.user_id !== user?.id &&
              member.role !== "owner" &&
              (role === "owner" || member.role !== "admin");
            return (
              <div className="flex flex-wrap items-center gap-3 border-b pb-3" key={member.user_id}>
                <span className="min-w-40 flex-1">
                  {member.name || "Membro da equipe"}
                  {member.user_id === user?.id ? " (você)" : ""}
                </span>
                {editable ? (
                  <>
                    <select
                      aria-label={`Função de ${member.name || "membro"}`}
                      className={inputStyle}
                      disabled={busy}
                      value={member.role}
                      onChange={(e) => {
                        void manageMember(member.user_id, e.target.value);
                      }}
                    >
                      {Object.entries(roles)
                        .filter(([key]) => key !== "owner" && (role === "owner" || key !== "admin"))
                        .map(([key, label]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ))}
                    </select>
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Retirar o acesso de ${member.name || "este membro"} a esta empresa?`,
                          )
                        )
                          void manageMember(member.user_id, null);
                      }}
                    >
                      Retirar acesso
                    </Button>
                  </>
                ) : (
                  <span className="text-sm">{roles[member.role]}</span>
                )}
              </div>
            );
          })}
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                const { error } = await supabase.rpc("invite_company_member", {
                  p_company: companyId,
                  p_email: email,
                  p_role: memberRole,
                });
                if (error) throw error;
                setEmail("");
                await refreshAccess();
                toast.success("Convite disponível na conta do destinatário por 7 dias.");
              });
            }}
          >
            <h3 className="font-medium">Convidar pessoa</h3>
            <Label htmlFor="invite-email">E-mail do convidado</Label>
            <Input
              id="invite-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <select
              aria-label="Função do convidado"
              className={inputStyle}
              value={memberRole}
              onChange={(e) => setMemberRole(e.target.value)}
            >
              {Object.entries(roles)
                .filter(([key]) => key !== "owner" && (role === "owner" || key !== "admin"))
                .map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
            </select>
            <p className="text-sm text-muted-foreground">
              O convite aparecerá dentro da Ceny quando a pessoa entrar com este e-mail confirmado.
              Avise-a para acessar a Ceny; esta ação não envia e-mail.
            </p>
            <Button disabled={busy}>Criar convite</Button>
          </form>
          <h3 className="font-medium">Convites aguardando aceite</h3>
          {pending.error && <p role="alert">Não foi possível consultar os convites da equipe.</p>}
          {pending.data?.map((inv) => (
            <div className="flex flex-wrap items-center justify-between gap-2" key={inv.id}>
              <span className="text-sm">
                {inv.email} · {roles[inv.role]} ·{" "}
                {new Date(inv.expires_at) <= new Date()
                  ? "Expirado"
                  : `Até ${new Date(inv.expires_at).toLocaleDateString("pt-BR")}`}
              </span>
              {(role === "owner" || inv.role !== "admin") && (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      const { error } = await supabase.rpc("revoke_company_invitation", {
                        p_id: inv.id,
                      });
                      if (error) throw error;
                      await refreshAccess();
                    })
                  }
                >
                  Revogar convite
                </Button>
              )}
            </div>
          ))}
        </section>
      )}
      <section className="space-y-4 rounded-lg border p-5">
        <h2 className="font-semibold">Recuperação administrativa</h2>
        <p className="text-sm">
          Se esqueceu a senha, use “Esqueci minha senha” na entrada. Para recuperar a
          responsabilidade pela empresa, entre com o e-mail de emergência previamente escolhido e
          use o código guardado fora da Ceny.
        </p>
        <Label htmlFor="reauth-password">Sua senha atual — confirmar identidade</Label>
        <Input
          id="reauth-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {role === "owner" && (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                if (!recoveryConsent) throw new Error("Confirme a autorização de recuperação.");
                await reauthenticate();
                const { data, error } = await supabase.rpc("configure_company_recovery", {
                  p_company: companyId,
                  p_email: recoveryEmail,
                });
                if (error) throw error;
                setIssuedCode(data);
                toast.success("Código criado. Guarde-o agora em um local seguro.");
              });
            }}
          >
            <Label htmlFor="recovery-email">E-mail de emergência autorizado</Label>
            <Input
              id="recovery-email"
              type="email"
              required
              value={recoveryEmail}
              onChange={(e) => setRecoveryEmail(e.target.value)}
            />
            <label className="flex gap-2 text-sm">
              <input
                type="checkbox"
                checked={recoveryConsent}
                onChange={(e) => setRecoveryConsent(e.target.checked)}
                required
              />
              Autorizo esta conta, junto com o código, a assumir a responsabilidade pela empresa e
              retirar o acesso do responsável anterior.
            </label>
            <p className="text-sm text-muted-foreground">
              O código vale por um ano, funciona uma única vez e substitui qualquer código anterior.
              O e-mail sozinho não basta. Guarde o código separado do acesso ao e-mail.
            </p>
            <Button variant="outline" disabled={busy}>
              Gerar novo código de emergência
            </Button>
            {issuedCode && (
              <div className="space-y-2 rounded border p-3">
                <p>Código exibido somente agora:</p>
                <code className="block break-all select-all">{issuedCode}</code>
                <Button type="button" variant="outline" onClick={() => setIssuedCode("")}>
                  Já guardei — ocultar código
                </Button>
              </div>
            )}
          </form>
        )}
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              await reauthenticate();
              const { data, error } = await supabase.rpc("recover_company_access", {
                p_code: recoveryCode.trim(),
              });
              if (error) throw error;
              setRecoveryCode("");
              await refreshAccess();
              await selectCompany(data);
              toast.success(
                "Acesso administrativo recuperado. Revise a equipe e gere um novo código.",
              );
            });
          }}
        >
          <Label htmlFor="recovery-code">Código de emergência</Label>
          <Input
            id="recovery-code"
            type="password"
            autoComplete="off"
            value={recoveryCode}
            onChange={(e) => setRecoveryCode(e.target.value)}
            required
          />
          <Button disabled={busy}>Recuperar responsabilidade pela empresa</Button>
        </form>
      </section>
    </section>
  );
}
import { ProductQuality } from "./product-quality";
