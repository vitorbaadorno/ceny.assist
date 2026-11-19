import { serverFailure } from "./lib/error-capture";
import { securityHeaders, secureResponse } from "./lib/security-headers";
type ServerEntry = {
  fetch: (
    request: Request,
    options: { context: { nonce: string } },
  ) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  return serverFailure();
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const nonce = crypto.randomUUID().replaceAll("-", "");
    const headers = securityHeaders(
      request,
      nonce,
      process.env["SUPABASE_URL"],
      Boolean(import.meta.env.DEV),
    );
    try {
      const handler = await getServerEntry();
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set("x-ceny-csp-nonce", nonce);
      const response = await handler.fetch(
        new Request(request.url, {
          headers: requestHeaders,
          method: request.method,
          ...(request.method === "GET" || request.method === "HEAD"
            ? {}
            : { body: request.body, duplex: "half" }),
          signal: request.signal,
        }),
        { context: { nonce } },
      );
      return secureResponse(await normalizeCatastrophicSsrResponse(response), headers);
    } catch {
      return secureResponse(serverFailure(), headers);
    }
  },
};
