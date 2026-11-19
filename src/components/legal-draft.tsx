export function LegalLinks() {
  return (
    <nav
      aria-label="Documentos para revisão"
      className="flex flex-wrap justify-center gap-4 p-4 text-sm underline"
    >
      <a href="/privacidade">Privacidade — minuta</a>
      <a href="/termos">Termos — minuta</a>
      <a href="/cookies">Cookies — minuta</a>
    </nav>
  );
}

export function LegalDraft({ title, text }: { title: string; text: string }) {
  return (
    <main className="mx-auto max-w-3xl space-y-5 px-5 py-10">
      <a href="/auth" className="underline">
        Voltar ao acesso
      </a>
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p role="note" className="rounded border p-3">
        MINUTA — NÃO VALIDADA JURIDICAMENTE. Preparada para revisão; não representa contrato
        vigente.
      </p>
      <article className="space-y-4">
        {text
          .split(/\n\n+/)
          .filter((part) => !part.startsWith("# "))
          .map((part, i) =>
            part.startsWith("## ") ? (
              <section key={i}>
                <h2 className="text-lg font-semibold">{part.split("\n")[0]?.slice(3)}</h2>
                <p className="whitespace-pre-line">{part.split("\n").slice(1).join("\n")}</p>
              </section>
            ) : (
              <p key={i} className="whitespace-pre-line">
                {part.replaceAll("**", "")}
              </p>
            ),
          )}
      </article>
      <LegalLinks />
    </main>
  );
}
