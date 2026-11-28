import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { extractCode, matchPhoneVerification } from "@/lib/telefono/codigo";
import { firmaValida, leerWebhook, mismoTextoSeguro } from "@/lib/whatsapp/webhook";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Verificación inicial del webhook de Meta. */
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

  const bytes = Buffer.from(await request.arrayBuffer());
  if (!firmaValida(bytes, request.headers.get("x-hub-signature-256"), secreto)) {
    return NextResponse.json({ error: "firma inválida" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(bytes.toString("utf8"));
  } catch {
    return NextResponse.json({ ok: true, ignored: true });
  }

  // Con firma válida se responde 200 siempre: si no, Meta reintenta durante días.
  for (const mensaje of leerWebhook(payload)) {
    const code = extractCode(mensaje.texto);
    if (!code) continue;
    try {
      const now = new Date();
      const pending = await prisma.phoneVerification.findFirst({
        where: { code, verifiedAt: null, codeExpiresAt: { gt: now } },
      });
      if (!pending) continue;
      if (matchPhoneVerification({ fromPhone: mensaje.waId, text: mensaje.texto, now, pending })) {
        await prisma.phoneVerification.update({ where: { id: pending.id }, data: { verifiedAt: now } });
      }
    } catch (error) {
      console.error(
        "[equipos][whatsapp] no se pudo verificar un teléfono",
        error instanceof Error ? error.name : "error",
      );
    }
  }
  return NextResponse.json({ ok: true });
}
