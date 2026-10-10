import { NextResponse } from "next/server";
import { adjuntosR2Configurado } from "@/lib/ficha/adjuntos-r2";
import { reintentarYLimpiarFotos } from "@/lib/galerias/fotos";
import { isAuthorizedCronRequest } from "@/lib/security/cron-auth";
import { sanitizeError } from "@/lib/payments/connect/log";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Tarea diaria de Galería: reintenta las fotos que quedaron PENDIENTE o en ERROR (con menos de 3
 * intentos) cuyo original ya está subido, y borra las PENDIENTE de 24 h o más que nunca llegaron.
 * Idempotente. Si algo falla en una foto, sigue con las demás.
 */
function autorizado(request: Request): boolean {
  return isAuthorizedCronRequest({
    authorizationHeader: request.headers.get("authorization"),
    allowedSecrets: [process.env.CRON_SECRET, process.env.FOTOFFICE_CRON_SECRET],
  });
}

export async function POST(request: Request) {
  if (!autorizado(request)) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  if (!adjuntosR2Configurado()) return NextResponse.json({ ok: true, omitido: "almacenamiento sin configurar" });
  try {
    return NextResponse.json({ ok: true, ...(await reintentarYLimpiarFotos(new Date())) });
  } catch (error) {
    console.error("[fotoffice][galerias] falló el reintento de fotos", { detalle: sanitizeError(error) });
    return NextResponse.json({ ok: false, error: "falló el reintento de fotos" }, { status: 500 });
  }
}

/** Vercel Cron usa GET. Mismo camino, misma autorización. */
export async function GET(request: Request) {
  return POST(request);
}
