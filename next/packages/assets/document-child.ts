import { validateDocumentZip } from "./document-zip.ts";

try {
  const buffer = Buffer.from(await Bun.stdin.arrayBuffer());
  if (buffer.length > 5 * 1024 * 1024) throw Error("invalid_document");
  let text: string;
  if (process.argv[2] === ".pdf") {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({
      data: new Uint8Array(buffer),
      isEvalSupported: false,
      disableFontFace: true,
      maxImageSize: 0,
      useSystemFonts: false,
      verbosity: 0,
    });
    try {
      text = (await parser.getText({ first: 50 })).text;
    } finally {
      await parser.destroy();
    }
  } else if (process.argv[2] === ".docx") {
    validateDocumentZip(buffer);
    const { extractRawText } = await import("mammoth");
    text = (await extractRawText({ buffer })).value;
  } else throw Error("invalid_document");
  const result = text.replaceAll("\0", "").trim().slice(0, 30_000);
  await Bun.write(Bun.stdout, JSON.stringify({ text: result }));
} catch {
  process.exitCode = 1;
}
