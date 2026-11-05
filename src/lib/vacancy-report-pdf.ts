import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { reportSections, type ReportAccess } from "./vacancy-report.ts";

export async function reportPdf(access: ReportAccess) {
  const doc = await PDFDocument.create();
  doc.setTitle("Ceny - Relatório de vaga");
  doc.setAuthor("Ceny");
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const supported = new Set(regular.getCharacterSet());
  // WinAnsi covers Portuguese. Preserve other code points explicitly instead of silently dropping them.
  const text = (v: string) =>
    [...v]
      .map((c) =>
        c === "\n" || supported.has(c.codePointAt(0)!)
          ? c
          : `[U+${c.codePointAt(0)!.toString(16).toUpperCase()}]`,
      )
      .join("");
  let page = doc.addPage([595.28, 841.89]);
  let y = 780;
  const newPage = () => {
    page = doc.addPage([595.28, 841.89]);
    y = 780;
  };
  const draw = (value: string, heading = false) => {
    const font = heading ? bold : regular,
      size = heading ? 12 : 10;
    const lineHeight = heading ? 18 : 14;
    for (const paragraph of text(value).split("\n")) {
      let line = "";
      const flush = () => {
        if (y < 65) newPage();
        page.drawText(line, {
          x: 44,
          y,
          font,
          size,
          color: heading ? rgb(0.1, 0.25, 0.35) : rgb(0.12, 0.14, 0.16),
        });
        y -= lineHeight;
        line = "";
      };
      for (const word of paragraph.split(/\s+/)) {
        if (font.widthOfTextAtSize(line ? `${line} ${word}` : word, size) > 507) {
          if (line) flush();
          // Long identifiers/URLs must wrap as well as natural language.
          for (const char of word) {
            if (font.widthOfTextAtSize(line + char, size) > 507) flush();
            line += char;
          }
        } else line += (line ? " " : "") + word;
      }
      flush();
    }
    y -= heading ? 5 : 6;
  };
  for (const section of reportSections(access)) {
    if (y < 115) newPage();
    draw(section.title, true);
    for (const paragraph of section.paragraphs) draw(paragraph);
    y -= 8;
  }
  draw("Caracteres fora da fonte são preservados como [U+código Unicode].");
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    p.drawText("CENY  /  RELATÓRIO DE RECRUTAMENTO", {
      x: 44,
      y: 811,
      font: bold,
      size: 8,
      color: rgb(0.25, 0.35, 0.4),
    });
    p.drawLine({
      start: { x: 44, y: 800 },
      end: { x: 551, y: 800 },
      thickness: 0.5,
      color: rgb(0.75, 0.8, 0.82),
    });
    p.drawText(`Uso autorizado · ${i + 1} / ${pages.length}`, {
      x: 44,
      y: 35,
      font: regular,
      size: 8,
      color: rgb(0.35, 0.4, 0.45),
    });
  });
  return doc.save();
}
