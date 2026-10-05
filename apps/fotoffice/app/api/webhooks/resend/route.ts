import { NextResponse } from "next/server";
import { verifySvix } from "@/lib/mailing/svix";
import { parseResendEvent } from "@/lib/mailing/webhook-events";
import { applyWebhookEvent } from "@/lib/mailing/webhook";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Avisos de Resend sobre los correos a socios: entregado, abierto, clic, rebote, queja.
 *
 * Se configura en Resend → Webhooks apuntando a `https://fotoffice.com/api/webhooks/resend`; el
 * secreto que da Resend (`whsec_…`) va en `RESEND_WEBHOOK_SECRET`. Sin secreto la ruta no existe
 * (404): nunca se acepta un aviso sin verificar la firma.
 * Spec: docs/superpowers/specs/2026-10-05-correo-a-socios-etapa-4-campanas-design.md
 */
export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim();
  if (!secret) return NextResponse.json({ error: "no disponible" }, { status: 404 });

  const body = await request.text();
  const firma = verifySvix({
    secret,
    id: request.headers.get("svix-id"),
    timestamp: request.headers.get("svix-timestamp"),
    signatureHeader: request.headers.get("svix-signature"),
    body,
    nowSeconds: Math.floor(Date.now() / 1000),
  });
  if (!firma.ok) return NextResponse.json({ error: "firma inválida" }, { status: 401 });

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "cuerpo inválido" }, { status: 400 });
  }
  const evento = parseResendEvent(payload, new Date());
  // Tipos que no usamos: se confirman igual, si no Resend los reintenta durante días.
  if (!evento) return NextResponse.json({ ok: true, ignored: true });

  try {
    const r = await applyWebhookEvent(evento);
    return NextResponse.json({ ok: true, result: r });
  } catch (error) {
    console.error("[fotoffice][correo] no se pudo anotar un aviso de Resend", {
      detalle: error instanceof Error ? error.message : "error desconocido",
    });
    // 500: Resend lo reintenta más tarde.
    return NextResponse.json({ error: "no se pudo anotar" }, { status: 500 });
  }
}
