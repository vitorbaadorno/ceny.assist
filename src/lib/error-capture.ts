import { renderErrorPage } from "./error-page";

export function serverFailure() {
  const operation = crypto.randomUUID();
  console.error({ source: "ssr", action: "render", code: "service", operation });
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8", "x-ceny-operation": operation },
  });
}
