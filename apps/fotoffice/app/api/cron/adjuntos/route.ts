import { NextResponse } from "next/server";
import { purgarAdjuntos } from "@/lib/ficha/adjuntos";
import { purgarAdjuntos as purgarAdjuntosProyecto } from "@/lib/proyectos/adjuntos";
import { adjuntosR2Configurado } from "@/lib/ficha/adjuntos-r2";
import { isAuthorizedCronRequest } from "@/lib/security/cron-auth";
import { sanitizeError } from "@/lib/payments/connect/log";
import { borrarConversacionesViejas } from "@/lib/dnx-bot/limpieza";
import { purgarCarpetas } from "@/lib/carpetas/carpeta";
import { purgarPreparaciones } from "@/lib/impresion/preparaciones";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Purga diaria de adjuntos privados: los borrados hace 30 días o más y las subidas que
 * nunca se confirmaron (PENDIENTE de 24 h o más), tanto de las fichas como de los proyectos. Idempotente: correrla de más no cambia
 * nada. Si un objeto no se puede borrar, sigue con los demás y lo cuenta en `fallidos`.
 *
 * Además (aunque los adjuntos no estén configurados) borra las conversaciones de DNX Bot de
 * FOTOFFICE sin movimiento hace 90 días (`lib/dnx-bot/limpieza.ts`). Si eso falla, sólo se registra.
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
  try {
    await borrarConversacionesViejas(new Date());
  } catch (error) {
    console.error("[fotoffice][dnx-bot] falló la limpieza de conversaciones", { detalle: sanitizeError(error) });
  }
  if (!adjuntosR2Configurado()) {
    return NextResponse.json({ ok: true, omitido: "adjuntos sin configurar" });
  }
  try {
    const ahora = new Date();
    const [a, b] = [await purgarAdjuntos(ahora), await purgarAdjuntosProyecto(ahora)];
    // Carpetas de trabajos vencidas (30 días desde que se compartieron) y subidas sin confirmar.
    const carpetas = await purgarCarpetas(ahora);
    // Preparaciones de impresión de más de 30 días (originales, vistas y finales). La copia del
    // original de carnet en la ficha del cliente NO se toca: es un adjunto aparte. Si falla, las
    // demás purgas ya corrieron: se registra y se informa, sin tirar el resto del trabajo.
    let preparaciones: number | null = null;
    try {
      preparaciones = await purgarPreparaciones(ahora);
    } catch (error) {
      console.error("[fotoffice][impresion] falló la purga de preparaciones", { detalle: sanitizeError(error) });
    }
    return NextResponse.json({
      ok: true,
      carpetas,
      preparaciones,
      ...(preparaciones === null ? { preparacionesFallo: true } : {}),
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
