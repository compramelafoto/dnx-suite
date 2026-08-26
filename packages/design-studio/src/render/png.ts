import { fail, ok, type Result } from "../result";

export type PdfToPngOptions = {
  /** Puntos por pulgada del raster. El PDF está en puntos, que son 72 por pulgada. */
  dpi: number;
  /** Cara a rasterizar, empezando en 0. */
  pageIndex: number;
};

/**
 * Rasteriza una cara del PDF ya emitido.
 *
 * El import es dinámico a propósito: `pdf-to-png-converter` arrastra un binario nativo
 * (@napi-rs/canvas) y no debe entrar en el grafo de módulos de quien solo quiera leer un
 * documento o validar una plantilla.
 */
export async function pdfToPng(
  pdf: Uint8Array,
  options: PdfToPngOptions,
): Promise<Result<Uint8Array>> {
  if (options.pageIndex < 0) {
    return fail("El número de cara no puede ser negativo.");
  }
  try {
    const { pdfToPng: convertir } = await import("pdf-to-png-converter");
    // La librería pide un ArrayBuffer, no un Buffer de Node. `slice` acota exactamente la
    // porción del búfer que ocupa este PDF: pasar el búfer entero traería basura de al lado.
    const buffer = pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength);
    const salida = await convertir(buffer as ArrayBuffer, {
      pagesToProcess: [options.pageIndex + 1],
      viewportScale: options.dpi / 72,
    });
    const primera = salida[0];
    if (!primera?.content) {
      return fail(`El PDF no tiene una cara número ${options.pageIndex + 1}.`);
    }
    return ok(new Uint8Array(primera.content));
  } catch (e) {
    return fail(
      `No se pudo convertir el PDF a imagen: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}
