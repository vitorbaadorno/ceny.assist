const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

function operationFor(path: string, method: string) {
  if (/report|export/.test(path)) return "export";
  if (/privacy|erasure/.test(path)) return "erase";
  if (/rank/.test(path)) return "rank";
  if (/analysis|resume_job/.test(path)) return "reprocess";
  if (/review|decision/.test(path)) return "review";
  if (/member|invite/.test(path)) return "access";
  if (/ops_/.test(path)) return "settings";
  return method === "GET" || method === "HEAD" ? "query" : "save";
}

// Extract only the tenant key. Never send URLs, headers, bodies, query text or exceptions to logs.
export async function monitoredFetch(base: string, input: RequestInfo | URL, init: RequestInit) {
  const url = new URL(input instanceof Request ? input.url : input.toString(), base);
  if (
    url.origin !== new URL(base).origin ||
    !url.pathname.startsWith("/rest/v1/") ||
    url.pathname.endsWith("/ops_report_error")
  )
    return fetch(input, init);
  const action = operationFor(url.pathname, init.method ?? "GET");
  const operation = crypto.randomUUID();
  function report(code: string) {
    let company: unknown = url.searchParams.get("company_id")?.replace(/^eq\./, "");
    if (!company && typeof init.body === "string") {
      try {
        const args = JSON.parse(init.body);
        company = args?.p_company ?? args?.company_id;
      } catch {
        /* Non-JSON requests have no verified company argument. */
      }
    }
    const headers = new Headers(init.headers);
    const auth = headers.get("authorization"),
      key = headers.get("apikey");
    if (typeof company === "string" && uuid.test(company) && auth && key) {
      void fetch(new URL("/rest/v1/rpc/ops_report_error", base), {
        method: "POST",
        redirect: "error",
        headers: { authorization: auth, apikey: key, "content-type": "application/json" },
        body: JSON.stringify({
          p_company: company,
          p_operation: operation,
          p_action: action,
          p_code: code,
        }),
        signal: AbortSignal.timeout(5000),
      }).catch(() => {});
    }
    console.error({ source: "data", operation, action, code });
  }
  let response: Response;
  try {
    response = await fetch(input, init);
  } catch (error) {
    if (!init.signal?.aborted) report("connection");
    throw error;
  }
  if (!response.ok) {
    const status = response.status;
    report(
      status === 401
        ? "session"
        : status === 403
          ? "permission"
          : status === 404
            ? "missing"
            : status === 409
              ? "conflict"
              : status === 429
                ? "limit"
                : status >= 500
                  ? "service"
                  : "invalid",
    );
  }
  return response;
}
