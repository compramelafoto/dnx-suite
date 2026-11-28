import { NextResponse } from "next/server";
import { casillaClf, leerAviso, verificarSvix } from "@/lib/inbound-email/parse";
import { traerCorreo } from "@/lib/inbound-email/resend-api";
import { guardarCorreo } from "@/lib/inbound-email/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Aviso de Resend (`email.received`) por cada correo que llega a una casilla de la cuenta. Guarda
 * los que son de @compramelafoto.com para la bandeja de Admin → Emails → Recibidos.
 *
 * Se configura en Resend → Webhooks apuntando a `https://compramelafoto.com/api/webhooks/resend-inbound`
 * con el evento `email.received`; el secreto (`whsec_…`) va en `RESEND_INBOUND_WEBHOOK_SECRET`. Sin
 * secreto la ruta no existe (404).
 *
 * El aviso no trae el cuerpo: se pide a Resend. Si eso o la base fallan, 500 para que Resend reintente.
 */
export async function POST(request: Request) {
  const secreto = process.env.RESEND_INBOUND_WEBHOOK_SECRET?.trim();
  if (!secreto) return NextResponse.json({ error: "no disponible" }, { status: 404 });

  const cuerpo = await request.text();
  const valida = verificarSvix({
    secreto,
    id: request.headers.get("svix-id"),
    timestamp: request.headers.get("svix-timestamp"),
    firmas: request.headers.get("svix-signature"),
    cuerpo,
    ahoraS: Math.floor(Date.now() / 1000),
  });
  if (!valida) return NextResponse.json({ error: "firma inválida" }, { status: 401 });

  let payload: unknown;
  try {
    payload = JSON.parse(cuerpo);
  } catch {
    return NextResponse.json({ error: "cuerpo inválido" }, { status: 400 });
  }
  const aviso = leerAviso(payload);
  // Otros tipos se confirman igual: si no, Resend los reintenta durante días.
  if (!aviso) return NextResponse.json({ ok: true, ignorado: true });
  // Correo de otro dominio de la cuenta (fotoffice.com, etc.) o de una casilla excluida.
  if (aviso.to.length > 0 && !casillaClf(aviso.to, aviso.cc)) return NextResponse.json({ ok: true, ignorado: true });

  const correo = await traerCorreo(aviso.emailId);
  if ("error" in correo) {
    console.error("[bandeja-clf] no se pudo leer un correo recibido de Resend", { detalle: correo.error });
    return NextResponse.json({ error: "no se pudo leer el correo" }, { status: 500 });
  }

  try {
    const r = await guardarCorreo(correo);
    return NextResponse.json({ ok: true, ...r });
  } catch (error) {
    console.error("[bandeja-clf] no se pudo guardar un correo recibido", {
      detalle: error instanceof Error ? error.message : "error desconocido",
    });
    return NextResponse.json({ error: "no se pudo guardar" }, { status: 500 });
  }
}
