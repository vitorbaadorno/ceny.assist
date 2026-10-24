import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const roles: Record<string, string> = {
  owner: "Proprietário",
  admin: "Administrador",
  recruiter: "Recrutador",
  viewer: "Consulta",
};

export function CompanySettings() {
  const { companyId, role, canAdmin } = useCompany();
  const { user } = useAuth();
  const cache = useQueryClient();
  const [name, setName] = useState("");
  const [userId, setUserId] = useState("");
  const [memberRole, setMemberRole] = useState("recruiter");
  const [busy, setBusy] = useState(false);
  const { data: members = [], error } = useQuery({
    queryKey: ["company-members", companyId],
    enabled: !!companyId && canAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_members")
        .select("user_id, role")
        .eq("company_id", companyId);
      if (error) throw error;
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in(
          "id",
          data.map((m) => m.user_id),
        );
      if (profileError) throw profileError;
      return data.map((m) => ({ ...m, name: profiles.find((p) => p.id === m.user_id)?.full_name }));
    },
  });

  async function createCompany(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.rpc("create_company", { p_name: name });
      if (error) throw error;
      setName("");
      await cache.invalidateQueries({ queryKey: ["memberships"] });
      toast.success("Empresa cadastrada. Selecione-a no menu para trabalhar.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível cadastrar a empresa.");
    } finally {
      setBusy(false);
    }
  }
  async function manageMember(id: string, newRole: string | null) {
    setBusy(true);
    try {
      const { error } = await supabase.rpc("manage_company_member", {
        p_company: companyId,
        p_user: id,
        p_role: newRole!,
      });
      if (error) throw error;
      await cache.invalidateQueries({ queryKey: ["company-members", companyId] });
      setUserId("");
      toast.success(newRole ? "Acesso atualizado." : "Acesso removido.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível alterar o acesso.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-3xl space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Empresas e acessos</h1>
        <p className="text-sm text-muted-foreground">
          Cada empresa tem seu próprio banco de candidatos, vagas e arquivos.
        </p>
      </header>
      <div className="rounded-lg border p-4 text-sm space-y-2">
        <p>
          Seu ID de acesso: <code className="break-all select-all">{user?.id}</code>
        </p>
        <p>
          Para entrar em uma empresa existente, compartilhe esse ID com o administrador após
          confirmar seu e-mail.
        </p>
      </div>
      <form onSubmit={createCompany} className="space-y-3 rounded-lg border p-5">
        <h2 className="font-semibold">Cadastrar empresa</h2>
        <Label htmlFor="company-name">Nome da empresa</Label>
        <Input
          id="company-name"
          required
          minLength={2}
          maxLength={160}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Button disabled={busy}>Cadastrar empresa</Button>
      </form>
      {canAdmin && (
        <div className="space-y-4 rounded-lg border p-5">
          <h2 className="font-semibold">Acessos à empresa selecionada</h2>
          <p className="text-sm text-muted-foreground">
            Consulta: leitura. Recrutador: cadastro e edição. Administrador: acessos e arquivamento.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void manageMember(userId, memberRole);
            }}
            className="space-y-3"
          >
            <Label htmlFor="member-id">ID do usuário (conta com e-mail confirmado)</Label>
            <Input
              id="member-id"
              required
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              pattern="[0-9a-fA-F-]{36}"
            />
            <Label htmlFor="member-role">Permissão</Label>
            <select
              id="member-role"
              className="block rounded border p-2 bg-background"
              value={memberRole}
              onChange={(e) => setMemberRole(e.target.value)}
            >
              <option value="viewer">Consulta</option>
              <option value="recruiter">Recrutador</option>
              {role === "owner" && <option value="admin">Administrador</option>}
            </select>
            <Button disabled={busy}>Adicionar ou atualizar acesso</Button>
          </form>
          {error && <p role="alert">Não foi possível carregar os acessos.</p>}
          <ul className="divide-y">
            {members.map((m) => (
              <li
                key={m.user_id}
                className="py-3 flex flex-wrap gap-3 items-center justify-between"
              >
                <div>
                  <p>
                    {m.name || "Usuário"} · {roles[m.role]}
                  </p>
                  <code className="text-xs break-all">{m.user_id}</code>
                </div>
                {m.role !== "owner" &&
                  m.user_id !== user?.id &&
                  (role === "owner" || m.role !== "admin") && (
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => manageMember(m.user_id, null)}
                    >
                      Remover acesso
                    </Button>
                  )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
