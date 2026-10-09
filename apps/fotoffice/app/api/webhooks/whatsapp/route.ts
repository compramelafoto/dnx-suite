import { NextResponse } from "next/server";
import { firmaValida, leerWebhook } from "@/lib/bandeja/webhook";
import { aplicarEventos } from "@/lib/bandeja/registro";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Webhook de WhatsApp (Cloud API de Meta) para la Bandeja de WhatsApp.
 *
 * Se configura en Meta → WhatsApp → Configuración apuntando a `https://fotoffice.com/api/webhooks/whatsapp`.
 * - `GET`: verificación inicial; compara `hub.verify_token` con `WHATSAPP_WEBHOOK_VERIFY_TOKEN`.
 * - `POST`: mensajes, estados y ecos; firmados con `x-hub-signature-256` (HMAC-SHA256 con
 *   `WHATSAPP_APP_SECRET`). Sin esas variables la ruta no existe (404): nunca se acepta un aviso sin verificar.
 * Spec: docs/superpowers/specs/2026-10-09-bandeja-whatsapp-design.md (§5)
 */
export async function GET(request: Request) {
  const token = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim();
  if (!token) return NextResponse.json({ error: "no disponible" }, { status: 404 });

  const q = new URL(request.url).searchParams;
  if (q.get("hub.mode") === "subscribe" && q.get("hub.verify_token") === token) {
    return new Response(q.get("hub.challenge") ?? "", { status: 200, headers: { "content-type": "text/plain" } });
  }
  return NextResponse.json({ error: "prohibido" }, { status: 403 });
}

export async function POST(request: Request) {
  const secreto = process.env.WHATSAPP_APP_SECRET?.trim();
  if (!secreto) return NextResponse.json({ error: "no disponible" }, { status: 404 });

  const cuerpo = await request.text();
  if (!firmaValida(cuerpo, request.headers.get("x-hub-signature-256"), secreto)) {
    return NextResponse.json({ error: "firma inválida" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(cuerpo);
  } catch {
    return NextResponse.json({ error: "cuerpo inválido" }, { status: 400 });
  }

  // Lo que no entendemos se confirma igual: si no, Meta lo reintenta durante días.
  const eventos = leerWebhook(payload);
  if (eventos.length === 0) return NextResponse.json({ ok: true, ignored: true });

  try {
    const r = await aplicarEventos(eventos);
    return NextResponse.json({ ok: true, ...r });
  } catch (error) {
    console.error("[fotoffice][whatsapp] no se pudo registrar un aviso de Meta", {
      detalle: error instanceof Error ? error.message : "error desconocido",
    });
    // 500: Meta lo reintenta más tarde; el registro es idempotente por waMessageId.
    return NextResponse.json({ error: "no se pudo registrar" }, { status: 500 });
  }
}
