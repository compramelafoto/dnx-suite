/**
 * Rasteriza una cara del PDF ya emitido, con MuPDF compilado a WebAssembly.
 *
 * El PDF sale bien desde el primer día: `pdf-lib` incrusta las tipografías adentro y el carnet
 * impreso lo demuestra. Lo único que faltaba era convertirlo en imagen, y ahí se fueron ocho
 * intentos de despliegue con `pdf-to-png-converter` → `@napi-rs/canvas`: una pieza nativa
 * distinta por sistema operativo que nunca terminaba de llegar entera al servidor —primero no
 * se subía, después reventaba el disco del build, después estaba en el cajón de otro paquete,
 * después faltaba el worker, después el enlace, después el binario—.
 *
 * WebAssembly no tiene ese problema: es **un solo archivo igual para todos los sistemas**, que
 * viaja como cualquier módulo de JavaScript. No hay variante por plataforma, ni enlace que
 * resolver, ni binario que copiar.
 *
 * Se descartó rasterizar el SVG con `sharp`: librsvg ignora las tipografías incrustadas con
 * `@font-face` —medido: el mismo texto en una condensada y en una ancha sale exactamente igual
 * de ancho—, así que la pieza salía con otra letra o, en un servidor sin tipografías, sin nada.
 */
import { fail, ok, type Result } from "../result";

export type PdfToPngOptions = {
  /** Puntos por pulgada del raster. El PDF está en puntos, que son 72 por pulgada. */
  dpi: number;
  /** Cara a rasterizar, empezando en 0. */
  pageIndex: number;
};

export type PdfToPngDeps = {
  /** Se puede inyectar para probar cómo llega el módulo según lo empaquete quien lo use. */
  cargarMupdf?: () => Promise<typeof import("mupdf")>;
};

export async function pdfToPng(
  pdf: Uint8Array,
  options: PdfToPngOptions,
  deps: PdfToPngDeps = {},
): Promise<Result<Uint8Array>> {
  if (options.pageIndex < 0) {
    return fail("El número de cara no puede ser negativo.");
  }

  try {
    // Import dinámico: el módulo carga su WebAssembly al importarse, y quien sólo valida un
    // documento o emite un PDF no tiene por qué pagar ese arranque.
    const cargar = deps.cargarMupdf ?? (() => import("mupdf"));
    /*
     * Según cómo lo empaquete quien use el módulo, `import()` devuelve el espacio de nombres o
     * el módulo envuelto en `default`. Cuando llega envuelto, `mupdf.Document` queda indefinido
     * y el fallo aparece minificado como "a is not a function", que no dice absolutamente nada.
     */
    const cargado = await cargar();
    const mupdf = (
      "Document" in cargado
        ? cargado
        : (cargado as unknown as { default: typeof cargado }).default
    ) as typeof cargado;

    const doc = mupdf.Document.openDocument(pdf, "application/pdf");
    if (options.pageIndex >= doc.countPages()) {
      return fail(`El PDF no tiene una cara número ${options.pageIndex + 1}.`);
    }

    const page = doc.loadPage(options.pageIndex);
    const escala = options.dpi / 72;
    const pixmap = page.toPixmap(
      mupdf.Matrix.scale(escala, escala),
      mupdf.ColorSpace.DeviceRGB,
      // Sin canal alfa: la pieza siempre tiene fondo, y un PNG opaco pesa bastante menos.
      false,
      true,
    );

    return ok(new Uint8Array(pixmap.asPNG()));
  } catch (e) {
    return fail(
      `No se pudo convertir el PDF a imagen: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}
