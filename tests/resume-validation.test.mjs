import test from "node:test";
import assert from "node:assert/strict";
import { strToU8 } from "fflate";
import { validateFile } from "../supabase/functions/_shared/validate-file.ts";
import {
  readLimitedBody,
  checkFileEnvelope,
  FileRejected,
} from "../supabase/functions/_shared/file-policy.ts";
import { docxFixture, pdfFixture, pngFixture, jpegFixture } from "./resume-fixtures.mjs";

test("real PDF, DOCX, PNG and JPEG decode successfully", async () => {
  for (const [name, bytes, mime] of [
    ["cv.pdf", await pdfFixture(), "application/pdf"],
    [
      "cv.docx",
      docxFixture(),
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
    ["cv.png", pngFixture(), "image/png"],
    ["cv.jpg", jpegFixture(), "image/jpeg"],
  ]) {
    const result = await validateFile(name, bytes);
    assert.equal(result.mime, mime);
    assert.equal(result.pages, 1);
  }
});
test("DOCX extracts text without rendering HTML or fetching external resources", async () => {
  assert.match((await validateFile("cv.docx", docxFixture())).text, /Experiência em RH/);
});
test("empty, too large, legacy DOC and false extension rejected", async () => {
  for (const [name, size] of [
    ["cv.pdf", 0],
    ["cv.pdf", 10485761],
    ["cv.doc", 3],
  ])
    assert.throws(() => checkFileEnvelope(name, size), FileRejected);
  await assert.rejects(validateFile("cv.pdf", jpegFixture()), /conteúdo real/);
  await assert.rejects(validateFile("cv.docx", strToU8("PKthis is not word")), FileRejected);
});
test("actual PDF pages and DOCX page estimates enforce 20-page limit", async () => {
  await assert.rejects(validateFile("cv.pdf", await pdfFixture(21)), /20 páginas/);
  await assert.rejects(validateFile("cv.docx", docxFixture({ pages: 21 })), /20 páginas/);
});
test("PDF scripts, cyclic page tree and decompression bomb are refused", async () => {
  await assert.rejects(validateFile("cv.pdf", await pdfFixture(1, { script: true })), /scripts/);
  await assert.rejects(validateFile("cv.pdf", await pdfFixture(1, { cycle: true })), /árvore/);
  await assert.rejects(
    validateFile("cv.pdf", await pdfFixture(1, { bomb: true })),
    /descompactação/,
  );
});
test("corrupt PDF, image and DOCX CRC cannot reach processing", async () => {
  const zip = docxFixture();
  zip[50] ^= 255;
  await assert.rejects(validateFile("cv.docx", zip), FileRejected);
  await assert.rejects(validateFile("cv.pdf", strToU8("%PDF-1.7\ninvalid%%EOF")), FileRejected);
  const png = pngFixture();
  png[40] ^= 255;
  await assert.rejects(validateFile("cv.png", png), FileRejected);
});
test("DOCX macros, external templates, XML entities, ZIP bombs and traversal refused", async () => {
  const fixtures = [
    docxFixture({ extra: { "word/vbaProject.bin": strToU8("test") } }),
    docxFixture({
      extra: {
        "word/_rels/settings.xml.rels": strToU8(
          '<Relationships><Relationship Type="attachedTemplate" TargetMode="External" Target="https://example.invalid/template"/></Relationships>',
        ),
      },
    }),
    docxFixture({ documentXml: '<!DOCTYPE x [<!ENTITY a "expand">]><x>&a;</x>' }),
    docxFixture({ extra: { "word/bomb.xml": strToU8("A".repeat(4 * 1024 * 1024 + 1)) } }),
    docxFixture({ extra: { "../escape": strToU8("test") } }),
  ];
  for (const bytes of fixtures) await assert.rejects(validateFile("cv.docx", bytes), FileRejected);
});
test("huge image dimensions rejected before decoding", async () => {
  const png = pngFixture();
  new DataView(png.buffer, png.byteOffset, png.byteLength).setUint32(16, 10000000);
  await assert.rejects(validateFile("cv.png", png), /megapixels/);
});
test("streamed request limits enforced without Content-Length and cancel producer", async () => {
  let cancelled = false;
  const stream = new ReadableStream({
    start(c) {
      c.enqueue(new Uint8Array(6));
      c.enqueue(new Uint8Array(6));
    },
    cancel() {
      cancelled = true;
    },
  });
  await assert.rejects(
    readLimitedBody(
      new Request("https://local.invalid", { method: "POST", body: stream, duplex: "half" }),
      10,
    ),
    /10 MB/,
  );
  assert.ok(cancelled);
});
