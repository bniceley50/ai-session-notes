import { Document, Packer, Paragraph, TextRun } from "docx";

export type DocxExportOptions = {
  title?: string;
};

function toParagraphs(text: string): Paragraph[] {
  const normalized = text.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");

  if (lines.length === 0) {
    return [new Paragraph("")];
  }

  return lines.map((line) =>
    new Paragraph({
      children: [new TextRun(line)],
    }),
  );
}

export function buildDocxDocument(text: string, options: DocxExportOptions = {}): Document {
  const contentParagraphs = toParagraphs(text);

  const children = options.title
    ? [
        new Paragraph({
          children: [new TextRun({ text: options.title, bold: true, size: 28 })],
          spacing: { after: 240 },
        }),
        ...contentParagraphs,
      ]
    : contentParagraphs;

  return new Document({
    sections: [
      {
        children,
      },
    ],
  });
}

export async function createDocxBlobFromText(
  text: string,
  options: DocxExportOptions = {},
): Promise<Blob> {
  const document = buildDocxDocument(text, options);
  return Packer.toBlob(document);
}

export async function createDocxBufferFromText(
  text: string,
  options: DocxExportOptions = {},
): Promise<Buffer> {
  const document = buildDocxDocument(text, options);
  return Packer.toBuffer(document);
}

