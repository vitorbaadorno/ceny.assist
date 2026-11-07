import { errorFeedback } from "@/lib/ui-feedback";
import { Button } from "@/components/ui/button";

export function QueryError({
  error,
  retry,
  busy = false,
  fallback,
}: {
  error: unknown;
  retry?: (() => unknown) | undefined;
  busy?: boolean;
  fallback?: string | undefined;
}) {
  const feedback = errorFeedback(error, fallback);
  return (
    <div role="alert" className="space-y-2 rounded border p-3 text-sm">
      <p>{feedback.message}</p>
      {feedback.kind === "session" ? (
        <a className="underline" href="/auth?reauth=entrar">
          Entrar novamente
        </a>
      ) : feedback.retryable && retry ? (
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => {
            void retry();
          }}
        >
          {busy ? "Tentando novamente…" : "Tentar novamente"}
        </Button>
      ) : null}
    </div>
  );
}
export function LoadingState({ children }: { children: React.ReactNode }) {
  return (
    <p role="status" aria-live="polite">
      {children}
    </p>
  );
}
