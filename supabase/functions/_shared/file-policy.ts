export const FILE_LIMITS = {
  bytes: 10 * 1024 * 1024,
  files: 5,
  pages: 20,
  pixels: 8_000_000,
  expanded: 20 * 1024 * 1024,
  text: 60_000,
} as const;
export const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export const FILE_ACCEPT = ".pdf,.docx,.jpg,.jpeg,.png";
export class FileRejected extends Error {}
export function checkFileEnvelope(name: string, size: number) {
  if (!size) throw new FileRejected("O arquivo está vazio.");
  if (size > FILE_LIMITS.bytes) throw new FileRejected("O arquivo ultrapassa 10 MB.");
  if (!name || name.length > 180 || /[\x00-\x1f/\\]/.test(name))
    throw new FileRejected("O nome do arquivo é inválido ou muito longo.");
  if (!/\.(pdf|docx|jpe?g|png)$/i.test(name))
    throw new FileRejected(
      "Formato não aceito. Use PDF, DOCX, JPG ou PNG. DOC e arquivos com macros não são aceitos.",
    );
}
export async function readLimitedBody(
  request: Request,
  limit: number = FILE_LIMITS.bytes,
): Promise<Uint8Array> {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > limit) throw new FileRejected("O arquivo ultrapassa 10 MB.");
  if (!request.body) throw new FileRejected("O arquivo está vazio.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > limit) throw new FileRejected("O arquivo ultrapassa 10 MB.");
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}
