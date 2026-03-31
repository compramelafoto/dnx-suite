import "server-only";

/**
 * Conversión PDF → PNG solo en Node (pdf-to-png-converter → @napi-rs/canvas).
 * Import dinámico para que Turbopack no analice binarios nativos en el grafo de páginas/actions ligeras.
 */
export async function pdfBufferToPngBuffer(pdf: Buffer): Promise<Buffer | null> {
  try {
    const mod = await import("pdf-to-png-converter");
    const pdfToPng = mod.pdfToPng;
    const pdfAb = pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength);
    const out = await pdfToPng(pdfAb, {
      pagesToProcess: [1],
      returnPageContent: true,
      viewportScale: 2,
    });
    const first = out[0];
    if (!first?.content) return null;
    return Buffer.from(first.content);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[diplomas] PNG raster no disponible (PDF sigue válido):", msg);
    return null;
  }
}
