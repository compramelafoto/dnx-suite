import { after, NextResponse } from "next/server";
import { verifySvix } from "@/lib/mailing/svix";
import { leerAvisoEntrante, procesarEntrantes, registrarEntrante, traerCorreoRecibido } from "@/lib/agentes/vendedor/entrante";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/** El procesamiento (`after`) puede llamar a Claude y mandar correos: necesita tiempo. */
export const maxDuration = 300;

/** Lo que puede tardar `procesarEntrantes` dentro de `after`, con margen sobre `maxDuration`. */
const TIEMPO_PROCESO_MS = 240_000;

/**
 * Correos que llegan a daniel@compramelafoto.com (Resend Inbound, aviso `email.received`): las
 * respuestas a los correos del agente Vendedor.
 *
 * Se configura en Resend → Webhooks apuntando a `https://fotoffice.com/api/webhooks/resend-entrante`;
 * el secreto (`whsec_…`) va en `RESEND_INBOUND_WEBHOOK_SECRET`. Sin secreto la ruta no existe (404).
 *
 * El aviso no trae el cuerpo: se pide a Resend. Si eso falla, 500 para que Resend reintente. El
 * correo se guarda una sola vez aunque el aviso llegue repetido, y se procesa después de responder.
 */
export async function POST(request: Request) {
  const secret = process.env.RESEND_INBOUND_WEBHOOK_SECRET?.trim();
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
  const aviso = leerAvisoEntrante(payload);
  // Otros tipos se confirman igual: si no, Resend los reintenta durante días.
  if (!aviso) return NextResponse.json({ ok: true, ignored: true });

  const correo = await traerCorreoRecibido(aviso.emailId);
  if ("error" in correo) {
    console.error("[agentes][vendedor] no se pudo leer un correo entrante de Resend", { detalle: correo.error });
    return NextResponse.json({ error: "no se pudo leer el correo" }, { status: 500 });
  }

  let nuevo: boolean;
  try {
    nuevo = (await registrarEntrante(correo, new Date())).nuevo;
  } catch (error) {
    console.error("[agentes][vendedor] no se pudo guardar un correo entrante", {
      detalle: error instanceof Error ? error.message : "error desconocido",
    });
    return NextResponse.json({ error: "no se pudo guardar" }, { status: 500 });
  }

  // También con un aviso repetido: si una corrida anterior se cortó, éste lo retoma.
  after(async () => {
    try {
      await procesarEntrantes({ hasta: Date.now() + TIEMPO_PROCESO_MS });
    } catch (error) {
      console.error("[agentes][vendedor] falló el procesamiento de correos entrantes", {
        detalle: error instanceof Error ? error.message : "error desconocido",
      });
    }
  });
  return NextResponse.json({ ok: true, nuevo });
}
