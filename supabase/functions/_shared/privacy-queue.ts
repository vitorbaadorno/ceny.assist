import type { SupabaseClient } from "npm:@supabase/supabase-js@2.116.0";
import type { Database } from "./database.ts";

type Erasure = { id: string; token: string; files: { bucket: string; path: string }[] };
// A lease can be reclaimed after termination. Removing a missing object is idempotent.
// Never call Storage unless the transaction that purges relational data has committed.
export async function runPrivacyQueue(admin: SupabaseClient<Database>) {
  const { data, error } = await admin.rpc("claim_privacy_erasure");
  if (error) throw new Error("Fila de eliminação indisponível.");
  if (!data) return false;
  const op = data as unknown as Erasure;
  let success = true;
  try {
    for (let offset = 0; offset < op.files.length; offset += 50) {
      const files = op.files.slice(offset, offset + 50);
      if (files.some((f) => f.bucket !== "resumes")) throw new Error("Armazenamento inesperado.");
      const { error } = await admin.storage.from("resumes").remove(files.map((f) => f.path));
      if (error) {
        success = false;
        break;
      }
    }
  } catch {
    success = false;
  }
  const { error: finishError } = await admin.rpc("finish_privacy_erasure", {
    p_operation: op.id,
    p_token: op.token,
    p_success: success,
  });
  // If this acknowledgment fails, the durable file manifest survives for retry.
  if (finishError)
    throw new Error("A confirmação da eliminação será retomada após expirar a reserva.");
  return true;
}
