import { NextResponse } from "next/server";
import { firmaValida, leerWebhook, mismoTextoSeguro } from "@/lib/bandeja/webhook";
import { aplicarEventos, detalleDeError } from "@/lib/bandeja/registro";

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
  if (q.get("hub.mode") === "subscribe" && mismoTextoSeguro(q.get("hub.verify_token") ?? "", token)) {
    return new Response(q.get("hub.challenge") ?? "", {
      status: 200,
      headers: { "content-type": "text/plain", "x-content-type-options": "nosniff" },
    });
  }
  return NextResponse.json({ error: "prohibido" }, { status: 403 });
}

export async function POST(request: Request) {
  const secreto = process.env.WHATSAPP_APP_SECRET?.trim();
  if (!secreto) return NextResponse.json({ error: "no disponible" }, { status: 404 });

  // La firma se calcula sobre los bytes crudos; recién después se decodifica el texto.
  const bytes = Buffer.from(await request.arrayBuffer());
  if (!firmaValida(bytes, request.headers.get("x-hub-signature-256"), secreto)) {
    return NextResponse.json({ error: "firma inválida" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(bytes.toString("utf8"));
  } catch {
    return NextResponse.json({ error: "cuerpo inválido" }, { status: 400 });
  }

  // Lo que no entendemos se confirma igual: si no, Meta lo reintenta durante días.
  const eventos = leerWebhook(payload);
  if (eventos.length === 0) return NextResponse.json({ ok: true, ignored: true });

  try {
    const r = await aplicarEventos(eventos);
    // Si algún evento falló, 500: Meta reintenta el lote y lo ya aplicado es idempotente.
    if (r.fallidos > 0) return NextResponse.json({ error: "no se pudo registrar" }, { status: 500 });
    return NextResponse.json({ ok: true, ...r });
  } catch (error) {
    // Sólo nombre y código: el mensaje de un error de Prisma puede traer textos o teléfonos.
    console.error("[fotoffice][whatsapp] no se pudo registrar un aviso de Meta", detalleDeError(error));
    return NextResponse.json({ error: "no se pudo registrar" }, { status: 500 });
  }
}
