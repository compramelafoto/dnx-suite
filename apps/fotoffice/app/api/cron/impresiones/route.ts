import { NextResponse } from "next/server";
import { adjuntosR2Configurado } from "@/lib/ficha/adjuntos-r2";
import { procesarPedidosDeImpresion } from "@/lib/impresiones/preparar-servidor";
import { purgarOriginalesProbador } from "@/lib/probador/purga.server";
import { isAuthorizedCronRequest } from "@/lib/security/cron-auth";
import { sanitizeError } from "@/lib/payments/connect/log";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Cada 5 minutos: concilia los pedidos de impresión sin pagar cuyo aviso de Mercado Pago no llegó y prepara
 * hasta 3 pedidos pagados (recorte, ZIP ordenado por laboratorio en la carpeta del trabajo y correo "PARA
 * MAÑANA"). Un pedido trabado más de 15 minutos se vuelve a tomar (al tercero se corta); los que esperaban un
 * circuito de trabajo se reencolan solos cuando existe (ver `lib/impresiones/preparar-servidor.ts`).
 * También borra las fotos del probador de cuadros que ya no hacen falta (`lib/probador/purga.server.ts`).
 */
function autorizado(request: Request): boolean {
  return isAuthorizedCronRequest({
    authorizationHeader: request.headers.get("authorization"),
    allowedSecrets: [process.env.CRON_SECRET, process.env.FOTOFFICE_CRON_SECRET],
  });
}

export async function POST(request: Request) {
  if (!autorizado(request)) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  // Sin almacenamiento no se puede preparar, pero los pagos se concilian igual.
  const preparar = adjuntosR2Configurado();
  try {
    const r = await procesarPedidosDeImpresion({}, { preparar });
    // La purga es un plus: si falla, los pedidos igual se prepararon.
    const fotosProbadorBorradas = preparar
      ? await purgarOriginalesProbador(new Date()).catch((e) => {
          console.error("[fotoffice][probador] falló la purga de fotos", { detalle: sanitizeError(e) });
          return 0;
        })
      : 0;
    return NextResponse.json({ ok: true, ...r, fotosProbadorBorradas, ...(preparar ? {} : { omitido: "preparación: almacenamiento sin configurar" }) });
  } catch (error) {
    console.error("[fotoffice][impresiones] falló la preparación de pedidos", { detalle: sanitizeError(error) });
    return NextResponse.json({ ok: false, error: "falló la preparación de pedidos" }, { status: 500 });
  }
}

/** Vercel Cron usa GET. Mismo camino, misma autorización. */
export async function GET(request: Request) {
  return POST(request);
}
