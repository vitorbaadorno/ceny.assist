import { retryQuery } from "@/lib/ui-feedback";
import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";

const requestNonce = createIsomorphicFn()
  .server(() => getRequestHeader("x-ceny-csp-nonce"))
  .client(() => document.querySelector<HTMLScriptElement>("script[nonce]")?.nonce);

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: retryQuery, networkMode: "always" },
      mutations: { retry: false, networkMode: "always" },
    },
  });

  const nonce = requestNonce();
  const router = createRouter({
    routeTree,
    ssr: nonce ? { nonce } : {},
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
