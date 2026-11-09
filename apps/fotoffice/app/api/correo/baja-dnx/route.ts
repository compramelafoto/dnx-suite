import { NextResponse } from "next/server";
import { darDeBajaVendedor } from "@/lib/agentes/vendedor/baja";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Baja de un clic (RFC 8058) de los correos del Vendedor: Gmail, Yahoo y Apple Mail hacen un POST a
 * esta dirección (la de `List-Unsubscribe`) cuando la persona toca «Anular suscripción».
 *
 * Sólo POST da de baja. Un GET (un antivirus que abre los enlaces del correo para revisarlos) no
 * debe dar de baja a nadie: redirige a la página, donde la persona elige.
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  try {
    const r = await darDeBajaVendedor(url.searchParams.get("t"));
    if (r === "INVALIDO") return NextResponse.json({ error: "Enlace inválido." }, { status: 400 });
  } catch (error) {
    console.error("[agentes][vendedor] no se pudo registrar la baja de un clic", {
      detalle: error instanceof Error ? error.message : "error desconocido",
    });
    return NextResponse.json({ error: "No se pudo registrar la baja." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const destino = new URL("/correo/baja-dnx", url.origin);
  const t = url.searchParams.get("t");
  if (t) destino.searchParams.set("t", t);
  return NextResponse.redirect(destino, 303);
}
