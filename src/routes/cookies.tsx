import { createFileRoute } from "@tanstack/react-router";
import { LegalDraft } from "@/components/legal-draft";
import text from "../../docs/juridico/politica-cookies.md?raw";
export const Route = createFileRoute("/cookies")({
  component: () => <LegalDraft title="Cookies e Armazenamento" text={text} />,
});
