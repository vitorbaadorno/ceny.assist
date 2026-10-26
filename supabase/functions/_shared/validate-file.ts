import { Buffer } from "node:buffer";
import {
  PDFDocument,
  PDFDict,
  PDFName,
  PDFRawStream,
  PDFArray,
  PDFNumber,
  PDFObjectParser,
  PDFObjectStreamParser,
  PDFContext,
  PDFString,
  PDFHexString,
  decodePDFRawStream,
} from "pdf-lib";
import DecodeStreamModule from "pdf-lib/cjs/core/streams/DecodeStream.js";
import { SaxesParser } from "saxes";
import jpeg from "jpeg-js";
import { PNG } from "pngjs";
import { FILE_LIMITS, DOCX_MIME, checkFileEnvelope, FileRejected } from "./file-policy.ts";

// Pinned pdf-lib 1.17.1 adapter: bound allocations BEFORE decompression, including
// compressed object streams parsed by PDFDocument.load. Tests cover this boundary.
const DecodeStream = (DecodeStreamModule as any).default ?? DecodeStreamModule;
const ensureBuffer = DecodeStream.prototype.ensureBuffer;
DecodeStream.prototype.ensureBuffer = function (size: number) {
  if (size > 16 * 1024 * 1024) throw new FileRejected("PDF excede o limite de descompactação.");
  return ensureBuffer.call(this, size);
};
const parseObject = PDFObjectParser.prototype.parseObject;
const parserBudgets = new WeakMap<object, { count: number; depth: number; start: number }>();
PDFObjectParser.prototype.parseObject = function () {
  const context = (this as any).context;
  const budget = parserBudgets.get(context) ?? { count: 0, depth: 0, start: Date.now() };
  parserBudgets.set(context, budget);
  if (++budget.count > 30000 || ++budget.depth > 50 || Date.now() - budget.start > 3000)
    throw new FileRejected("PDF complexo demais para leitura segura.");
  try {
    return parseObject.call(this);
  } finally {
    budget.depth--;
  }
};
const assign = PDFContext.prototype.assign;
const objectCounts = new WeakMap<object, number>();
PDFContext.prototype.assign = function (ref, object) {
  const count = (objectCounts.get(this) ?? 0) + 1;
  objectCounts.set(this, count);
  if (count > 5000) throw new FileRejected("PDF possui objetos demais.");
  return assign.call(this, ref, object);
};
const forStream = PDFObjectStreamParser.forStream;
PDFObjectStreamParser.forStream = (stream, wait) => {
  const n = stream.dict.lookup(PDFName.of("N"));
  if (!(n instanceof PDFNumber) || n.asNumber() < 0 || n.asNumber() > 5000)
    throw new FileRejected("PDF possui objetos demais.");
  return forStream(stream, wait);
};

const decoder = new TextDecoder("utf-8", { fatal: true });
function reject(message: string): never {
  throw new FileRejected(message);
}
function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
async function expand(bytes: Uint8Array, expected: number) {
  const reader = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"))
    .getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > expected) reject("DOCX excede o tamanho descompactado declarado.");
      chunks.push(value);
    }
  } catch (e) {
    await reader.cancel().catch(() => {});
    throw e;
  }
  if (size !== expected) reject("DOCX corrompido: tamanho interno incompatível.");
  const result = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    result.set(c, offset);
    offset += c.length;
  }
  return result;
}
async function readZip(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let p = bytes.length - 22; p >= Math.max(0, bytes.length - 65557); p--)
    if (view.getUint32(p, true) === 0x06054b50) {
      end = p;
      break;
    }
  if (end < 0 || end + 22 + view.getUint16(end + 20, true) !== bytes.length)
    reject("DOCX corrompido ou com conteúdo adicional.");
  const count = view.getUint16(end + 10, true),
    centralSize = view.getUint32(end + 12, true),
    start = view.getUint32(end + 16, true);
  if (
    view.getUint16(end + 4, true) ||
    view.getUint16(end + 6, true) ||
    count !== view.getUint16(end + 8, true) ||
    count > 200 ||
    start + centralSize !== end
  )
    reject("DOCX com estrutura ZIP incompatível.");
  const files = new Map<string, Uint8Array>();
  let pos = start,
    total = 0;
  const ranges: [number, number][] = [];
  for (let i = 0; i < count; i++) {
    if (pos + 46 > end || view.getUint32(pos, true) !== 0x02014b50) reject("DOCX corrompido.");
    const flags = view.getUint16(pos + 8, true),
      method = view.getUint16(pos + 10, true),
      crc = view.getUint32(pos + 16, true),
      compressed = view.getUint32(pos + 20, true),
      size = view.getUint32(pos + 24, true);
    const nameLen = view.getUint16(pos + 28, true),
      extra = view.getUint16(pos + 30, true),
      comment = view.getUint16(pos + 32, true),
      local = view.getUint32(pos + 42, true);
    const name = decoder.decode(bytes.subarray(pos + 46, pos + 46 + nameLen));
    if (
      flags & 1 ||
      ![0, 8].includes(method) ||
      !name ||
      name.length > 240 ||
      name.includes("..") ||
      name.includes("\\") ||
      name.startsWith("/") ||
      files.has(name)
    )
      reject("DOCX criptografado ou com caminhos internos incompatíveis.");
    total += size;
    if (
      size > 4 * 1024 * 1024 ||
      total > FILE_LIMITS.expanded ||
      size > Math.max(1, compressed) * 200
    )
      reject("DOCX excede o limite de descompactação (20 MB, 4 MB por componente, razão 200:1).");
    if (
      local + 30 > start ||
      view.getUint32(local, true) !== 0x04034b50 ||
      view.getUint16(local + 6, true) !== flags ||
      view.getUint16(local + 8, true) !== method
    )
      reject("DOCX corrompido.");
    const localName = view.getUint16(local + 26, true),
      dataStart = local + 30 + localName + view.getUint16(local + 28, true),
      dataEnd = dataStart + compressed;
    if (
      dataEnd > start ||
      decoder.decode(bytes.subarray(local + 30, local + 30 + localName)) !== name ||
      ranges.some(([a, b]) => local < b && dataEnd > a)
    )
      reject("DOCX com componentes sobrepostos ou inválidos.");
    ranges.push([local, dataEnd]);
    const packed = bytes.subarray(dataStart, dataEnd),
      content = method === 8 ? await expand(packed, size) : packed;
    if (content.length !== size || crc32(content) !== crc)
      reject("DOCX corrompido: verificação de integridade falhou.");
    files.set(name, content);
    pos += 46 + nameLen + extra + comment;
  }
  if (pos !== end) reject("DOCX corrompido.");
  return files;
}
const wordNs = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
function xml(
  content: Uint8Array,
  onTag: (tag: any) => void,
  onText = (text: string) => {},
  onClose = (tag: any) => void 0,
) {
  const parser = new SaxesParser({ xmlns: true });
  let depth = 0,
    nodes = 0;
  parser.on("doctype", () => reject("Documentos com DTD ou entidades externas não são aceitos."));
  parser.on("opentag", (tag) => {
    if (++depth > 50 || ++nodes > 30000) reject("DOCX complexo demais.");
    onTag(tag);
  });
  parser.on("closetag", (tag) => {
    depth--;
    onClose(tag);
  });
  parser.on("text", onText);
  parser.on("cdata", onText);
  parser.write(decoder.decode(content)).close();
}
async function docx(bytes: Uint8Array) {
  const files = await readZip(bytes);
  const document = files.get("word/document.xml"),
    types = files.get("[Content_Types].xml");
  if (!document || !types || !files.has("_rels/.rels"))
    reject("O arquivo não é um documento Word DOCX válido.");
  let isWord = false,
    text = "",
    inText = false,
    breaks = 0,
    declared = 0,
    inPages = false,
    root = false;
  for (const [name, content] of files) {
    if (/vba|embeddings|activeX|oleObject|\.exe$|\.bin$/i.test(name))
      reject("DOCX com macros ou objetos incorporados não é aceito.");
    if (!name.endsWith("/") && !name.endsWith(".xml") && !name.endsWith(".rels")) {
      if (!/\.(png|jpe?g)$/i.test(name))
        reject("DOCX contém um componente incompatível. Remova anexos e exporte novamente.");
      await validateFile(name.split("/").pop()!, content);
    }
    if (name.endsWith(".xml") || name.endsWith(".rels"))
      xml(
        content,
        (tag) => {
          const attrs = Object.fromEntries(
            Object.values(tag.attributes).map((a: any) => [a.local, a.value]),
          );
          if (name === "[Content_Types].xml") {
            if (/macroEnabled|vba|oleObject|activeX/i.test(String(attrs["ContentType"])))
              reject("DOCX com conteúdo ativo não é aceito.");
            if (
              attrs["PartName"] === "/word/document.xml" &&
              attrs["ContentType"] ===
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"
            )
              isWord = true;
          }
          if (
            name.endsWith(".rels") &&
            attrs["TargetMode"] === "External" &&
            !(
              String(attrs["Type"]).endsWith("/hyperlink") &&
              /^(https?:|mailto:)/i.test(String(attrs["Target"]))
            )
          )
            reject("DOCX contém referências externas não permitidas.");
          if (["altChunk", "object", "fldSimple", "instrText"].includes(tag.local))
            reject("DOCX com campos ativos ou conteúdo incorporado não é aceito.");
          if (name === "word/document.xml" && tag.uri === wordNs) {
            if (tag.local === "document") root = true;
            if (tag.local === "t") inText = true;
            if (tag.local === "br" && attrs["type"] === "page") breaks++;
            if (tag.local === "lastRenderedPageBreak") breaks++;
          }
          if (name === "docProps/app.xml" && tag.local === "Pages") inPages = true;
        },
        (value) => {
          if (name === "word/document.xml" && inText) {
            text += value;
            if (text.length > FILE_LIMITS.text) reject("DOCX excede 60.000 caracteres.");
          }
          if (name === "docProps/app.xml" && inPages) {
            const n = Number(value.trim());
            if (Number.isFinite(n)) declared = Math.max(declared, n);
          }
        },
        (tag) => {
          if (tag.local === "t") inText = false;
          if (name === "word/document.xml" && tag.local === "p") text += "\n";
          if (tag.local === "Pages") inPages = false;
        },
      );
  }
  if (!isWord || !root) reject("O arquivo não é um documento Word DOCX válido.");
  if (!text.trim())
    reject("DOCX sem texto legível. Para currículo digitalizado, envie PDF, JPG ou PNG.");
  const pages = Math.max(1, declared, breaks + 1, Math.ceil(text.length / 3000));
  if (pages > FILE_LIMITS.pages) reject("DOCX ultrapassa 20 páginas declaradas/estimadas.");
  return { mime: DOCX_MIME, pages, text };
}
async function pdf(bytes: Uint8Array) {
  if (!new TextDecoder().decode(bytes.subarray(-1024)).trimEnd().endsWith("%%EOF"))
    reject("PDF incompleto, corrompido ou com conteúdo adicional.");
  const doc = await PDFDocument.load(bytes, {
    throwOnInvalidObject: true,
    ignoreEncryption: false,
    updateMetadata: false,
    parseSpeed: 100,
  });
  const objects = doc.context.enumerateIndirectObjects();
  if (objects.length > 5000) reject("PDF possui objetos demais.");
  const visited = new Set<object>();
  let nodes = 0,
    expanded = 0;
  const forbidden = new Set([
    "JS",
    "JavaScript",
    "AA",
    "OpenAction",
    "Launch",
    "EmbeddedFiles",
    "EmbeddedFile",
    "Filespec",
    "EF",
    "RichMedia",
    "XFA",
    "SubmitForm",
    "ImportData",
    "GoToR",
    "GoToE",
    "Sound",
    "Movie",
  ]);
  const scan = (obj: any, depth = 0): void => {
    if (!obj || visited.has(obj)) return;
    visited.add(obj);
    if (++nodes > 30000 || depth > 50) reject("PDF complexo demais.");
    if (obj instanceof PDFName && forbidden.has(obj.decodeText()))
      reject("PDF contém scripts, anexos ou ações não permitidas.");
    if (obj instanceof PDFDict) {
      const uri = obj.lookup(PDFName.of("URI"));
      if (
        uri &&
        (!(uri instanceof PDFString || uri instanceof PDFHexString) ||
          !/^(https?:|mailto:)/i.test(uri.decodeText()))
      )
        reject("PDF contém um link externo incompatível.");
      for (const [k, v] of obj.entries()) {
        scan(k, depth + 1);
        scan(v, depth + 1);
      }
    }
    if (obj instanceof PDFArray) for (const v of obj.asArray()) scan(v, depth + 1);
    if (obj instanceof PDFRawStream) {
      scan(obj.dict, depth + 1);
      const w = obj.dict.lookup(PDFName.of("Width")),
        h = obj.dict.lookup(PDFName.of("Height"));
      if (
        w instanceof PDFNumber &&
        h instanceof PDFNumber &&
        w.asNumber() * h.asNumber() > FILE_LIMITS.pixels
      )
        reject("PDF contém imagem acima de 8 megapixels.");
      const filter = obj.dict.lookup(PDFName.of("Filter"));
      const filters = filter instanceof PDFArray ? filter.asArray() : [filter];
      if (
        filters.some(
          (f) =>
            f instanceof PDFName &&
            ["DCTDecode", "JPXDecode", "CCITTFaxDecode", "JBIG2Decode"].includes(f.decodeText()),
        )
      ) {
        // Non-JPEG image codecs have larger decoder attack surfaces; fail closed.
        if (
          filters.length !== 1 ||
          !(filter instanceof PDFName) ||
          filter.decodeText() !== "DCTDecode"
        )
          reject("PDF com compressão de imagem incompatível. Exporte novamente como PDF padrão.");
        jpeg.decode(obj.contents, {
          useTArray: true,
          tolerantDecoding: false,
          maxResolutionInMP: 8,
          maxMemoryUsageInMB: 64,
        });
      } else {
        expanded += decodePDFRawStream(obj).decode().length;
        if (expanded > FILE_LIMITS.expanded) reject("PDF excede 20 MB de conteúdo descompactado.");
      }
    }
  };
  for (const [, object] of objects) scan(object);
  // Validate page tree iteratively, avoiding cycles / unbounded library traversal.
  let pages = 0;
  const seen = new Set<object>();
  const stack = [doc.catalog.lookup(PDFName.of("Pages"))];
  while (stack.length) {
    const item = stack.pop();
    if (!(item instanceof PDFDict) || seen.has(item)) reject("PDF com árvore de páginas inválida.");
    seen.add(item);
    if (seen.size > 5000) reject("PDF complexo demais.");
    if (item.lookup(PDFName.of("Type")) === PDFName.of("Page")) {
      if (++pages > 20) reject("PDF ultrapassa 20 páginas.");
    } else {
      const kids = item.lookup(PDFName.of("Kids"));
      if (!(kids instanceof PDFArray)) reject("PDF corrompido.");
      for (let i = 0; i < kids.size(); i++) stack.push(kids.lookup(i));
    }
  }
  if (!pages) reject("PDF não possui páginas.");
  return { mime: "application/pdf", pages };
}
export async function validateFile(
  name: string,
  bytes: Uint8Array,
): Promise<{ mime: string; pages: number; text?: string }> {
  checkFileEnvelope(name, bytes.length);
  try {
    const ext = name.toLowerCase().split(".").pop();
    if (ext === "pdf" && new TextDecoder().decode(bytes.subarray(0, 5)) === "%PDF-")
      return await pdf(bytes);
    if (ext === "docx" && bytes[0] === 0x50 && bytes[1] === 0x4b) return await docx(bytes);
    if (
      ["jpg", "jpeg"].includes(ext!) &&
      bytes[0] === 255 &&
      bytes[1] === 216 &&
      bytes[bytes.length - 2] === 255 &&
      bytes[bytes.length - 1] === 217
    ) {
      jpeg.decode(bytes, {
        useTArray: true,
        tolerantDecoding: false,
        maxResolutionInMP: 8,
        maxMemoryUsageInMB: 64,
      });
      return { mime: "image/jpeg", pages: 1 };
    }
    if (
      ext === "png" &&
      bytes.length >= 33 &&
      [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v)
    ) {
      const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
        w = v.getUint32(16),
        h = v.getUint32(20);
      if (!w || !h || w * h > FILE_LIMITS.pixels)
        reject("Imagem ultrapassa 8 megapixels. Reduza a resolução.");
      if (bytes[28] !== 0 || bytes[24] !== 8)
        reject(
          "PNG entrelaçado ou com profundidade diferente de 8 bits não é aceito. Exporte como PNG padrão.",
        );
      let offset = 8,
        chunks = 0,
        ended = false;
      while (offset + 12 <= bytes.length) {
        const size = v.getUint32(offset),
          kind = new TextDecoder().decode(bytes.subarray(offset + 4, offset + 8));
        offset += size + 12;
        if (++chunks > 3000 || offset > bytes.length) reject("PNG corrompido ou complexo demais.");
        if (kind === "IEND") {
          ended = true;
          break;
        }
      }
      if (!ended || offset !== bytes.length) reject("PNG incompleto ou com conteúdo adicional.");
      PNG.sync.read(Buffer.from(bytes), { checkCRC: true });
      return { mime: "image/png", pages: 1 };
    }
    reject(
      "O conteúdo real não corresponde ao formato informado. Use PDF, DOCX, JPG ou PNG válidos.",
    );
  } catch (error) {
    if (error instanceof FileRejected) throw error;
    reject(
      "Arquivo corrompido, protegido por senha ou incompatível com a leitura segura. Exporte uma nova cópia.",
    );
  }
}
