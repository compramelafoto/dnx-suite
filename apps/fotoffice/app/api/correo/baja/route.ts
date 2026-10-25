import { NextResponse } from "next/server";
import { addOptOut, parseTopic, readUnsubscribeToken } from "@/lib/mailing/opt-out";

export const dynamic = "force-dynamic";

/**
 * Baja de un clic (RFC 8058). Gmail, Yahoo y Apple Mail muestran un botón «Anular suscripción»
 * junto al remitente y, al tocarlo, hacen un POST a esta dirección (la de `List-Unsubscribe`).
 *
 * Sólo POST da de baja. Un GET (un antivirus que abre los enlaces del correo para revisarlos) no
 * debe dar de baja a nadie: redirige a la página, donde la persona elige.
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const payload = readUnsubscribeToken(url.searchParams.get("t"));
  if (!payload) return NextResponse.json({ error: "Enlace inválido." }, { status: 400 });
  try {
    await addOptOut(payload.workspaceId, payload.email, parseTopic(url.searchParams.get("tema")));
  } catch (error) {
    console.error("[fotoffice][correo] no se pudo registrar la baja de un clic", {
      detalle: error instanceof Error ? error.message : "error desconocido",
    });
    return NextResponse.json({ error: "No se pudo registrar la baja." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const destino = new URL("/correo/baja", url.origin);
  url.searchParams.forEach((v, k) => destino.searchParams.set(k, v));
  return NextResponse.redirect(destino, 303);
}
