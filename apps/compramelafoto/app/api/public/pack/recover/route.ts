import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { normalizeEmail } from "@/lib/order-claims";
import { RESPUESTA_RECUPERAR_PACK, recuperarLinksDePack } from "@/lib/preventa-canjeable/recuperar-pack";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HORA_MS = 60 * 60 * 1000;
/** Pedidos por IP por hora: frena barridos de emails desde una misma máquina. */
const LIMITE_POR_IP = 10;
/** Pedidos por email por hora: evita llenar la casilla de alguien de links (y revocar sus tokens una y otra vez). */
const LIMITE_POR_EMAIL = 3;

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";

  const porIp = checkRateLimit({ key: `pack-recover:ip:${ip}`, limit: LIMITE_POR_IP, windowMs: HORA_MS });
  if (!porIp.allowed) {
    // El límite por IP no depende del email: no revela nada sobre su existencia.
    return NextResponse.json({ error: "Demasiadas solicitudes. Intentá más tarde." }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const rawEmail = typeof body?.email === "string" ? body.email : "";
  const email = normalizeEmail(rawEmail);

  if (email) {
    const porEmail = checkRateLimit({ key: `pack-recover:email:${email}`, limit: LIMITE_POR_EMAIL, windowMs: HORA_MS });
    if (!porEmail.allowed) {
      // Misma respuesta que un pedido normal: no se distingue si el email existe ni si fue limitado.
      return NextResponse.json({ ok: true, message: RESPUESTA_RECUPERAR_PACK });
    }
  }

  await recuperarLinksDePack(rawEmail);
  // Respuesta genérica para no revelar si existe o no el email.
  return NextResponse.json({ ok: true, message: RESPUESTA_RECUPERAR_PACK });
}
