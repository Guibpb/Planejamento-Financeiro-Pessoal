import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
GlobalWorkerOptions.workerSrc = workerUrl;

export async function readStatement(file: File): Promise<string[]> {
  if (file.size > 15_000_000) throw Error("Escolha um PDF de até 15 MB.");
  const task = getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  try {
    const doc = await task.promise;
    if (doc.numPages > 50)
      throw Error("Escolha uma fatura com até 50 páginas.");
    const pages: string[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n),
        content = await page.getTextContent();
      const lines: { y: number; items: { x: number; text: string }[] }[] = [];
      for (const item of content.items) {
        if (!("str" in item) || !item.str.trim()) continue;
        const y = item.transform[5];
        let line = lines.find((l) => Math.abs(l.y - y) < 2.5);
        if (!line) {
          line = { y, items: [] };
          lines.push(line);
        }
        line.items.push({ x: item.transform[4], text: item.str });
      }
      pages.push(
        lines
          .sort((a, b) => b.y - a.y)
          .map((l) =>
            l.items
              .sort((a, b) => a.x - b.x)
              .map((i) => i.text)
              .join(" "),
          )
          .join("\n"),
      );
    }
    return pages;
  } catch (e) {
    if (e instanceof Error && e.name === "PasswordException")
      throw Error(
        "O PDF está protegido por senha. Exporte uma cópia desbloqueada para importar.",
      );
    throw e;
  } finally {
    await task.destroy();
  }
}
