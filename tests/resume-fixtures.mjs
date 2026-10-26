import { zipSync, strToU8 } from "fflate";
import { PDFDocument, PDFName, PDFString } from "pdf-lib";
import jpeg from "jpeg-js";
import { PNG } from "pngjs";
export function docxFixture({
  text = "Currículo de Teste — Experiência em RH",
  pages = 1,
  extra = {},
  documentXml,
} = {}) {
  return zipSync({
    "[Content_Types].xml": strToU8(
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    ),
    "_rels/.rels": strToU8(
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    ),
    "word/document.xml": strToU8(
      documentXml ??
        `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`,
    ),
    "docProps/app.xml": strToU8(`<Properties><Pages>${pages}</Pages></Properties>`),
    ...extra,
  });
}
export async function pdfFixture(pages = 1, { script = false, bomb = false, cycle = false } = {}) {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage().drawText("Curriculo de teste");
  if (script)
    doc.catalog.set(
      PDFName.of("OpenAction"),
      doc.context.obj({ S: "JavaScript", JS: PDFString.of("alert(1)") }),
    );
  if (bomb) {
    const stream = doc.context.flateStream(new Uint8Array(18 * 1024 * 1024));
    doc.context.register(stream);
  }
  if (cycle) {
    const pages = doc.catalog.lookup(PDFName.of("Pages"));
    pages.set(PDFName.of("Kids"), doc.context.obj([doc.catalog.get(PDFName.of("Pages"))]));
  }
  return doc.save();
}
export function pngFixture() {
  return PNG.sync.write({ width: 2, height: 2, data: Buffer.alloc(16, 255) });
}
export function jpegFixture() {
  return jpeg.encode({ width: 2, height: 2, data: Buffer.alloc(16, 255) }).data;
}
