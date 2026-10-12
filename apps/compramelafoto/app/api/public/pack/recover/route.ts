import { NextResponse } from "next/server";
import { RESPUESTA_RECUPERAR_PACK, recuperarLinksDePack } from "@/lib/preventa-canjeable/recuperar-pack";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const rawEmail = typeof body?.email === "string" ? body.email : "";
  await recuperarLinksDePack(rawEmail);
  // Respuesta genérica para no revelar si existe o no el email.
  return NextResponse.json({ ok: true, message: RESPUESTA_RECUPERAR_PACK });
}
