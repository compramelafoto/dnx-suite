import "server-only";
import { prisma } from "@repo/db";
import { leerObjetoContrato } from "./almacen";
import { huellaPdf } from "./pdf";
import { nombreArchivoPdf } from "./pdf-documento";

/**
 * Descarga del PDF sellado de un contrato (etapa 5). Lo usan las dos rutas: la interna (con sesión y
 * permiso Ver) y la del firmante (con su enlace personal, sólo con el contrato FIRMADO). Cada ruta
 * resuelve su permiso; acá sólo se lee el archivo de ESE contrato en ESE workspace y se comprueba que sea
 * el mismo que se selló (huella): si no coincide, no se entrega.
 */
export type PdfDescargable = { ok: true; bytes: Uint8Array; nombre: string } | { ok: false };

export async function pdfParaDescargar(
  workspaceId: string,
  contratoId: string,
  deps: { leer?: (clave: string) => Promise<Uint8Array> } = {},
): Promise<PdfDescargable> {
  try {
    const c = await prisma.fotofficeContrato.findFirst({
      where: { id: contratoId, workspaceId, status: "FIRMADO" },
      select: { number: true, pdfKey: true, pdfHash: true },
    });
    if (!c || !c.pdfKey || !c.pdfHash) return { ok: false };
    const bytes = await (deps.leer ?? leerObjetoContrato)(c.pdfKey);
    if (huellaPdf(bytes) !== c.pdfHash) {
      console.error("[contratos] el PDF guardado no coincide con su huella", { codigo: "HUELLA_PDF_DISTINTA" });
      return { ok: false };
    }
    return { ok: true, bytes, nombre: nombreArchivoPdf(c.number) };
  } catch (e) {
    console.error("[contratos] no se pudo leer el PDF para descargar", { codigo: (e as { code?: unknown } | null)?.code ?? "desconocido" });
    return { ok: false };
  }
}

/** Respuesta de descarga: privada, sin caché ni indexación. */
export function respuestaPdf(bytes: Uint8Array, nombre: string): Response {
  return new Response(Buffer.from(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(bytes.byteLength),
      // `nombre` sale de `nombreArchivoPdf`: sólo letras, números, guiones y la extensión.
      "Content-Disposition": `attachment; filename="${nombre}"`,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Robots-Tag": "noindex, nofollow",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export function noEncontrado(): Response {
  return new Response("No encontrado", { status: 404, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" } });
}
