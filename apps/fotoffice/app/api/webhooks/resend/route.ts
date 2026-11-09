import { NextResponse } from "next/server";
import { verifySvix } from "@/lib/mailing/svix";
import { parseResendEvent } from "@/lib/mailing/webhook-events";
import { applyWebhookEvent } from "@/lib/mailing/webhook";
import { aplicarAvisoVendedor } from "@/lib/agentes/vendedor/avisos";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Avisos de Resend sobre los correos a socios y los del agente Vendedor: entregado, abierto, clic,
 * rebote, queja.
 *
 * Se configura en Resend → Webhooks apuntando a `https://fotoffice.com/api/webhooks/resend`; el
 * secreto que da Resend (`whsec_…`) va en `RESEND_WEBHOOK_SECRET`. Si el Vendedor manda con otra
 * cuenta de Resend (`VENDEDOR_RESEND_API_KEY` de otra cuenta), esa cuenta tiene su propio webhook con
 * su propio secreto, que va en `VENDEDOR_RESEND_WEBHOOK_SECRET`: la firma se prueba con cada uno.
 * Sin ningún secreto la ruta no existe (404): nunca se acepta un aviso sin verificar la firma.
 * Spec: docs/superpowers/specs/2026-10-05-correo-a-socios-etapa-4-campanas-design.md
 */
export async function POST(request: Request) {
  const secretos = [process.env.RESEND_WEBHOOK_SECRET, process.env.VENDEDOR_RESEND_WEBHOOK_SECRET]
    .map((s) => s?.trim())
    .filter((s): s is string => Boolean(s));
  if (secretos.length === 0) return NextResponse.json({ error: "no disponible" }, { status: 404 });

  const body = await request.text();
  const nowSeconds = Math.floor(Date.now() / 1000);
  const firmaOk = secretos.some(
    (secret) =>
      verifySvix({
        secret,
        id: request.headers.get("svix-id"),
        timestamp: request.headers.get("svix-timestamp"),
        signatureHeader: request.headers.get("svix-signature"),
        body,
        nowSeconds,
      }).ok,
  );
  if (!firmaOk) return NextResponse.json({ error: "firma inválida" }, { status: 401 });

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
    // Un correo que no es de una campaña puede ser del agente Vendedor (la misma cuenta de Resend).
    if (r === "UNKNOWN") {
      const vendedor = await aplicarAvisoVendedor(evento, new Date());
      return NextResponse.json({ ok: true, result: vendedor });
    }
    return NextResponse.json({ ok: true, result: r });
  } catch (error) {
    console.error("[fotoffice][correo] no se pudo anotar un aviso de Resend", {
      detalle: error instanceof Error ? error.message : "error desconocido",
    });
    // 500: Resend lo reintenta más tarde.
    return NextResponse.json({ error: "no se pudo anotar" }, { status: 500 });
  }
}
