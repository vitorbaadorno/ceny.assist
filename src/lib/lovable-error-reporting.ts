type LovableErrorOptions = {
  mechanism?: "manual" | "onerror" | "unhandledrejection" | "react_error_boundary";
  handled?: boolean;
  severity?: "error" | "warning" | "info";
};

type LovableEvents = {
  track?: (event: string, properties?: Record<string, unknown>) => string | null;
  captureException?: (
    error: unknown,
    context?: Record<string, unknown>,
    options?: LovableErrorOptions,
  ) => void;
};

declare global {
  interface Window {
    __lovableEvents?: LovableEvents;
    __lovableReportRuntimeError?: (payload: {
      message: string;
      stack?: string;
      filename?: string;
    }) => void;
  }
}

export function reportLovableError() {
  if (typeof window === "undefined") return;
  const operation = crypto.randomUUID();
  const message = "Falha de interface " + operation;
  window.__lovableEvents?.captureException?.(
    message,
    { operation },
    { mechanism: "react_error_boundary", handled: true },
  );
  window.__lovableReportRuntimeError?.({ message });
}
