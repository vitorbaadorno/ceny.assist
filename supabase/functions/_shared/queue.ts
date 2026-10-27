import type { SupabaseClient } from "npm:@supabase/supabase-js@2.116.0";
import type { Database, Json } from "./database.ts";
import { extractResume } from "./resumes.ts";
import { AiGatewayError } from "./ai.ts";
import { FileRejected, FILE_LIMITS } from "./file-policy.ts";
import { classifyFailure } from "./queue-policy.ts";
type Job = Database["public"]["Tables"]["resume_jobs"]["Row"];
type Client = SupabaseClient<Database>;

async function abortable<T>(operation: PromiseLike<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted();
  let listener: () => void;
  try {
    return await Promise.race([
      Promise.resolve(operation),
      new Promise<never>((_, reject) => {
        listener = () => reject(signal.reason);
        signal.addEventListener("abort", listener, { once: true });
      }),
    ]);
  } finally {
    signal.removeEventListener("abort", listener!);
  }
}
export async function runResumeJob(admin: Client, job: Job) {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new DOMException("Tempo máximo de leitura.", "TimeoutError")),
    120000,
  );
  const signal = controller.signal;
  const phase = async (value: string) => {
    signal.throwIfAborted();
    const { data, error } = await abortable(
      admin.rpc("advance_resume_job", { p_job: job.id, p_token: job.lease_token!, p_phase: value }),
      signal,
    );
    if (error) throw new Error("Falha temporária de persistência.");
    if (!data) {
      const denied = new Error("Trabalho não autorizado ou reserva expirada.");
      denied.name = "AuthorizationError";
      throw denied;
    }
  };
  try {
    if (!Deno.env.get("LOVABLE_API_KEY")) throw new AiGatewayError(401, "Configuração ausente.");
    await phase("downloading");
    const { data: document, error: docError } = await abortable(
      admin
        .from("resume_documents")
        .select("filename,byte_size,candidate_id")
        .eq("id", job.document_id)
        .eq("company_id", job.company_id)
        .eq("candidate_id", job.candidate_id)
        .single(),
      signal,
    );
    if (docError) throw new Error("Falha temporária ao consultar o documento.");
    if (!document) throw new FileRejected("Documento indisponível. Confira o original.");
    const { data: file, error: downloadError } = await abortable(
      admin.storage.from("resumes").download(`${job.company_id}/${job.candidate_id}/original`),
      signal,
    );
    if (downloadError || !file) throw new Error("Falha temporária no armazenamento.");
    if (file.size !== document.byte_size || file.size > FILE_LIMITS.bytes)
      throw new FileRejected("O original está incompleto ou incompatível.");
    await phase("validating");
    const bytes = new Uint8Array(await abortable(file.arrayBuffer(), signal));
    await phase("reading");
    const result = await abortable(extractResume(bytes, document.filename, signal), signal);
    await phase("saving");
    const { data: saved, error } = await abortable(
      admin.rpc("settle_resume_job", {
        p_job: job.id,
        p_token: job.lease_token!,
        p_outcome: result.status === "concluido" ? "succeeded" : "review",
        p_extraction: result.extraction as unknown as Json,
      }),
      signal,
    );
    if (error) throw new Error("Falha temporária de persistência.");
    return { id: job.id, saved: !!saved };
  } catch (error) {
    const failure = classifyFailure(error);
    const { error: saveError } = await admin.rpc("settle_resume_job", {
      p_job: job.id,
      p_token: job.lease_token!,
      p_outcome: "error",
      p_kind: failure.kind,
      p_message: failure.message,
    });
    // If persistence itself failed, the lease expires and the next scheduler tick recovers it.
    if (saveError)
      console.error(
        "Não foi possível registrar o resultado da tentativa; a reserva será recuperada.",
      );
    return { id: job.id, saved: !saveError };
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}
export async function runResumeQueue(admin: Client) {
  const { data: jobs, error } = await admin.rpc("claim_resume_jobs");
  if (error) throw new Error("Fila indisponível.");
  return await Promise.all((jobs ?? []).map((job) => runResumeJob(admin, job)));
}
