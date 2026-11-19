import { createFileRoute } from "@tanstack/react-router";
import { LegalDraft } from "@/components/legal-draft";
import text from "../../docs/juridico/termos-uso.md?raw";
export const Route = createFileRoute("/termos")({
  component: () => <LegalDraft title="Termos de Uso" text={text} />,
});
