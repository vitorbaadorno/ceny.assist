import { createContext, useContext, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

type Membership = { company_id: string; role: string; companies: { name: string } | null };
type CompanyContextValue = {
  companyId: string;
  role: string;
  memberships: Membership[];
  loading: boolean;
  error: Error | null;
  selectCompany: (id: string) => Promise<void>;
};
const CompanyContext = createContext<CompanyContextValue | null>(null);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const cache = useQueryClient();
  const [selected, setSelected] = useState("");
  const {
    data: memberships = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["memberships", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_members")
        .select("company_id, role, companies(name)")
        .eq("user_id", user!.id);
      if (error) throw error;
      return data;
    },
    refetchInterval: 15000,
    refetchOnWindowFocus: "always",
  });
  const membership = memberships.find((m) => m.company_id === selected) ?? memberships[0];
  const companyId = membership?.company_id ?? "";
  return (
    <CompanyContext.Provider
      value={{
        companyId,
        role: membership?.role ?? "",
        memberships,
        loading: isLoading,
        error,
        selectCompany: async (id) => {
          if (!memberships.some((m) => m.company_id === id)) return;
          await cache.cancelQueries();
          cache.removeQueries({ predicate: (q) => q.queryKey[0] !== "memberships" });
          setSelected(id);
        },
      }}
    >
      <div key={`${user?.id}:${companyId}`}>{children}</div>
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const context = useContext(CompanyContext);
  if (!context) throw new Error("Contexto da empresa indisponível.");
  return {
    ...context,
    canEdit: ["owner", "admin", "recruiter"].includes(context.role),
    canAdmin: ["owner", "admin"].includes(context.role),
  };
}
