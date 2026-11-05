import { CompanyProvider, useCompany } from "@/hooks/useCompany";
import { CompanySettings } from "@/components/company-settings";
import { PrivacyCenter } from "@/components/privacy-center";
import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Briefcase, LogOut, Upload, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

const nav = [
  { to: "/", label: "Candidatos", icon: Users },
  { to: "/upload", label: "Enviar currículos", icon: Upload },
  { to: "/vagas", label: "Vagas", icon: Briefcase },
] as const;

function AuthenticatedLayout() {
  return (
    <CompanyProvider>
      <CompanyLayout />
    </CompanyProvider>
  );
}

function CompanyLayout() {
  const {
    companyId,
    memberships,
    loading: companyLoading,
    error: companyError,
    selectCompany,
  } = useCompany();
  const [settings, setSettings] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const { session, loading, user, signOut, recoverySession } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/auth" });
    if (!loading && recoverySession) navigate({ to: "/reset-password" });
  }, [loading, session, navigate, recoverySession]);

  if (loading || !session || recoverySession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Carregando...
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background md:flex-row">
      <aside className="flex shrink-0 flex-col gap-6 bg-sidebar px-4 py-6 text-sidebar-foreground md:w-64">
        <div>
          <p className="text-xs uppercase tracking-widest text-sidebar-foreground/60">RH</p>
          <p className="text-lg font-semibold">Triagem de Currículos</p>
        </div>
        <label className="text-sm space-y-2">
          Empresa
          <select
            aria-label="Empresa ativa"
            className="block w-full rounded border bg-background text-foreground p-2"
            value={companyId}
            onChange={(e) => {
              void selectCompany(e.target.value)
                .then(() => navigate({ to: "/" }))
                .catch((error) => toast.error(error.message));
            }}
          >
            {!companyId && <option value="">Nenhuma empresa</option>}
            {memberships.map((m) => (
              <option key={m.company_id} value={m.company_id}>
                {m.companies?.name}
              </option>
            ))}
          </select>
        </label>
        <Button
          variant="secondary"
          onClick={() => {
            setPrivacy(false);
            setSettings((v) => !v);
          }}
        >
          {settings ? "Voltar ao trabalho" : "Empresas e acessos"}
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            setSettings(false);
            setPrivacy((v) => !v);
          }}
        >
          Privacidade e dados
        </Button>
        <nav className="flex flex-wrap gap-1 md:flex-col">
          {nav.map((item) => {
            const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            return (
              <Link
                onClick={() => {
                  setSettings(false);
                  setPrivacy(false);
                }}
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60",
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto space-y-2 border-t border-sidebar-border pt-4">
          <p className="truncate text-xs text-sidebar-foreground/70">{user?.email}</p>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            onClick={async () => {
              try {
                await signOut();
                navigate({ to: "/auth" });
              } catch {
                /* AuthProvider displays retry and hides company data. */
              }
            }}
          >
            <LogOut className="size-4" /> Sair
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-x-hidden px-4 py-8 md:px-10">
        {companyLoading ? (
          <p>Carregando empresas...</p>
        ) : companyError ? (
          <p role="alert">Não foi possível consultar suas empresas. Recarregue a página.</p>
        ) : settings || !companyId ? (
          <CompanySettings />
        ) : privacy ? (
          <PrivacyCenter onOpenCandidate={() => setPrivacy(false)} />
        ) : (
          <Outlet />
        )}
      </main>
    </div>
  );
}
