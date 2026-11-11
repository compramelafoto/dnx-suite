import { NextResponse } from "next/server";
import { readLiveConfig } from "@/lib/en-vivo/config";
import { aplicarAviso } from "@/lib/en-vivo/store";
import { leerAviso, verificarFirmaStream, verificarSecretoNotificacion } from "@/lib/en-vivo/webhook";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Avisos de Cloudflare Stream para la transmisión en vivo: señal conectada / cortada / con error
 * (Notificaciones de Cloudflare, encabezado `cf-webhook-auth`) y grabación lista (webhook de
 * Stream, encabezado `Webhook-Signature`). Ver `lib/en-vivo/webhook.ts`.
 *
 * URL a registrar: `https://fotoffice.com/api/webhooks/cloudflare-stream`. El secreto va en
 * `STREAM_WEBHOOK_SECRET`. Sin secreto la ruta no existe (404): nunca se acepta un aviso sin
 * verificar.
 *
 * Idempotente: los avisos se aplican con transiciones que no cambian nada si se repiten, y las
 * grabaciones se anotan por el uid del video. Un aviso que no es nuestro (un video de un curso
 * grabado, un canal de otra cuenta) se confirma igual para que Cloudflare no reintente.
 */
export async function POST(request: Request) {
  const config = readLiveConfig();
  const secreto = config.ok ? config.webhookSecret : process.env.STREAM_WEBHOOK_SECRET?.trim() || null;
  if (!secreto) return NextResponse.json({ error: "no disponible" }, { status: 404 });

  const cuerpo = await request.text();
  const firma = request.headers.get("webhook-signature");
  const verificacion = firma
    ? verificarFirmaStream({ secreto, encabezado: firma, cuerpo, ahoraSegundos: Math.floor(Date.now() / 1000) })
    : verificarSecretoNotificacion({ secreto, encabezado: request.headers.get("cf-webhook-auth") });
  if (!verificacion.ok) return NextResponse.json({ error: "firma inválida" }, { status: 401 });

  let payload: unknown;
  try {
    payload = JSON.parse(cuerpo);
  } catch {
    return NextResponse.json({ error: "cuerpo inválido" }, { status: 400 });
  }

  const aviso = leerAviso(payload, new Date());
  if (!aviso) return NextResponse.json({ ok: true, ignored: true });

  try {
    const resultado = await aplicarAviso(aviso, new Date());
    return NextResponse.json({ ok: true, result: resultado });
  } catch (error) {
    console.error("[fotoffice][en-vivo] no se pudo aplicar un aviso de Cloudflare", {
      tipo: aviso.tipo,
      detalle: error instanceof Error ? error.message : "error desconocido",
    });
    // 500: Cloudflare lo reintenta más tarde.
    return NextResponse.json({ error: "no se pudo aplicar" }, { status: 500 });
  }
}
