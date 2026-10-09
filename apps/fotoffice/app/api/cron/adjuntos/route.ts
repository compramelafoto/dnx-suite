import { NextResponse } from "next/server";
import { purgarAdjuntos } from "@/lib/ficha/adjuntos";
import { purgarAdjuntos as purgarAdjuntosProyecto } from "@/lib/proyectos/adjuntos";
import { adjuntosR2Configurado } from "@/lib/ficha/adjuntos-r2";
import { isAuthorizedCronRequest } from "@/lib/security/cron-auth";
import { sanitizeError } from "@/lib/payments/connect/log";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Purga diaria de adjuntos privados: los borrados hace 30 días o más y las subidas que
 * nunca se confirmaron (PENDIENTE de 24 h o más), tanto de las fichas como de los proyectos. Idempotente: correrla de más no cambia
 * nada. Si un objeto no se puede borrar, sigue con los demás y lo cuenta en `fallidos`.
 */
function autorizado(request: Request): boolean {
  return isAuthorizedCronRequest({
    authorizationHeader: request.headers.get("authorization"),
    allowedSecrets: [process.env.CRON_SECRET, process.env.FOTOFFICE_CRON_SECRET],
  });
}

export async function POST(request: Request) {
  if (!autorizado(request)) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }
  if (!adjuntosR2Configurado()) {
    return NextResponse.json({ ok: true, omitido: "adjuntos sin configurar" });
  }
  try {
    const ahora = new Date();
    const [a, b] = [await purgarAdjuntos(ahora), await purgarAdjuntosProyecto(ahora)];
    return NextResponse.json({
      ok: true,
      purgados: a.purgados + b.purgados,
      pendientesLimpios: a.pendientesLimpios + b.pendientesLimpios,
      fallidos: a.fallidos + b.fallidos,
    });
  } catch (error) {
    console.error("[fotoffice][adjuntos] falló la purga", { detalle: sanitizeError(error) });
    return NextResponse.json({ ok: false, error: "falló la purga de adjuntos" }, { status: 500 });
  }
}

/** Vercel Cron usa GET. Mismo camino, misma autorización. */
export async function GET(request: Request) {
  return POST(request);
}
