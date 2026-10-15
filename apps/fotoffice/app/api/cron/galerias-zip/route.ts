import { NextResponse } from "next/server";
import { adjuntosR2Configurado } from "@/lib/ficha/adjuntos-r2";
import { procesarDescargas } from "@/lib/galerias/descargas";
import { isAuthorizedCronRequest } from "@/lib/security/cron-auth";
import { sanitizeError } from "@/lib/payments/connect/log";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Cada 5 minutos: arma UNA parte (de hasta 1 GB) de la descarga completa de una galería de entrega, vence las
 * descargas de más de 7 días (borrando sus partes) y avisa por correo las que quedaron listas. Si una corrida
 * muere a mitad de una parte, la siguiente la rehace desde cero (ver `lib/galerias/descargas.ts`). Idempotente.
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
    return NextResponse.json({ ok: true, ...(await procesarDescargas()) });
  } catch (error) {
    console.error("[fotoffice][galerias-zip] falló el armado de descargas", { detalle: sanitizeError(error) });
    return NextResponse.json({ ok: false, error: "falló el armado de descargas" }, { status: 500 });
  }
}

/** Vercel Cron usa GET. Mismo camino, misma autorización. */
export async function GET(request: Request) {
  return POST(request);
}
