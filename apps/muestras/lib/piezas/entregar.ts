import "server-only";
import { createHash } from "node:crypto";
import { subirPdfAR2 } from "@/lib/imagenes/r2";

/** Vercel corta en 4,5 MB toda respuesta de una función: se deja margen. */
export const LIMITE_RESPUESTA_DIRECTA = 4 * 1024 * 1024;

/** El PDF directo si es liviano; si no, a R2 y 303 a su dirección (decisión D4). */
export async function entregarPdf(bytes: Uint8Array, o: { nombre: string; activityId: string }): Promise<Response> {
  // `nombre` sale de un slug (a-z, 0-9, guiones) y de opciones de una lista cerrada.
  const archivo = `${o.nombre}.pdf`;
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
    const url = await subirPdfAR2(bytes, `muestras/piezas/${o.activityId}/${huella}.pdf`, archivo);
    return new Response(null, { status: 303, headers: { Location: url, "Cache-Control": "private, no-store" } });
  } catch (err) {
    console.error("[piezas] no se pudo subir el PDF:", err instanceof Error ? err.message : String(err));
    return Response.json({ error: "El PDF es muy pesado y no pudimos prepararlo. Probá con una obra por vez." }, { status: 500 });
  }
}
