import { createFileRoute } from "@tanstack/react-router";
import { LegalDraft } from "@/components/legal-draft";
import text from "../../docs/juridico/politica-privacidade.md?raw";
export const Route = createFileRoute("/privacidade")({
  component: () => <LegalDraft title="Política de Privacidade" text={text} />,
});
