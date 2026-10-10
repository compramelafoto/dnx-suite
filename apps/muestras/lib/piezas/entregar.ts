import "server-only";
import { createHash } from "node:crypto";
import { CLAVE_PDF, clavePdf } from "@/lib/imagenes/clave-pdf";
import { subirPdfAR2 } from "@/lib/imagenes/r2";

/** Vercel corta en 4,5 MB toda respuesta de una función: se deja margen. */
export const LIMITE_RESPUESTA_DIRECTA = 4 * 1024 * 1024;

/**
 * Un error que se lee en el navegador: estos enlaces se abren directo (no los pide un `fetch`),
 * así que un JSON se vería crudo. Texto plano en español.
 */
export function errorEnTexto(mensaje: string, status: number): Response {
  return new Response(mensaje, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "private, no-store" } });
}

/** El PDF directo si es liviano; si no, a R2 y 303 a su dirección (decisión D4). */
export async function entregarPdf(bytes: Uint8Array, o: { nombre: string; activityId: string }): Promise<Response> {
  // `nombre` sale de un slug (a-z, 0-9, guiones) y de opciones de una lista cerrada.
  const archivo = `${o.nombre}.pdf`;
  // Se valida antes de armar la respuesta: con un id raro la subida fallaría y diríamos "muy pesado".
  if (!CLAVE_PDF.test(clavePdf(o.activityId, "0".repeat(32)))) {
    return errorEnTexto("No encontramos esa muestra.", 400);
  }
  if (bytes.byteLength <= LIMITE_RESPUESTA_DIRECTA) {
    return new Response(bytes as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${archivo}"`,
        "Cache-Control": "private, no-store",
      },
    });
  }
  const huella = createHash("sha256").update(bytes).digest("hex").slice(0, 32);
  try {
    const url = await subirPdfAR2(bytes, clavePdf(o.activityId, huella), archivo);
    return new Response(null, { status: 303, headers: { Location: url, "Cache-Control": "private, no-store" } });
  } catch (err) {
    console.error("[piezas] no se pudo subir el PDF:", err instanceof Error ? err.message : String(err));
    return errorEnTexto("El PDF es muy pesado y no pudimos prepararlo. Probá con una obra por vez.", 500);
  }
}
