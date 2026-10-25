import {
  createContext,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
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
  const [switching, setSwitching] = useState(false);
  const switchingRef = useRef(false);
  const previousScope = useRef("");
  const {
    data: memberships = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["memberships", user?.id],
    enabled: !!user,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase
        .from("company_members")
        .select("company_id, role, companies(name)")
        .eq("user_id", user!.id)
        .abortSignal(signal);
      if (error) throw error;
      return data;
    },
    refetchInterval: 15000,
    refetchOnWindowFocus: "always",
  });
  // A revoked selection does not silently open a different company.
  const membership = error
    ? undefined
    : selected
      ? memberships.find((m) => m.company_id === selected)
      : memberships[0];
  const companyId = membership?.company_id ?? "";
  const scope = `${user?.id}:${companyId}:${membership?.role ?? ""}`;
  useLayoutEffect(() => {
    if (!selected && membership) setSelected(membership.company_id);
    if (previousScope.current && previousScope.current !== scope) {
      void cache.cancelQueries({ predicate: (q) => q.queryKey[0] !== "memberships" });
      cache.removeQueries({ predicate: (q) => q.queryKey[0] !== "memberships" });
      cache.getMutationCache().clear();
    }
    previousScope.current = scope;
  }, [scope, cache, selected, membership]);
  return (
    <CompanyContext.Provider
      value={{
        companyId,
        role: membership?.role ?? "",
        memberships,
        loading: isLoading || switching,
        error,
        selectCompany: async (id) => {
          if (switchingRef.current) return;
          switchingRef.current = true;
          setSwitching(true);
          try {
            await cache.cancelQueries();
            cache.removeQueries({ predicate: (q) => q.queryKey[0] !== "memberships" });
            cache.getMutationCache().clear();
            const result = await refetch();
            if (result.error || !result.data?.some((m) => m.company_id === id))
              throw new Error("Seu acesso a esta empresa não está disponível.");
            setSelected(id);
          } finally {
            switchingRef.current = false;
            setSwitching(false);
          }
        },
      }}
    >
      {switching ? (
        <p className="p-10" role="status">
          Confirmando acesso à empresa…
        </p>
      ) : (
        <div key={scope}>{children}</div>
      )}
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
