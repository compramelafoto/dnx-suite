import { NextResponse } from "next/server";
import { composePiece, type ProposalViewport } from "@/lib/propuesta/compose";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Tope de subida: un logo razonable no pasa de esto. */
const MAX_LOGO_BYTES = 5 * 1024 * 1024;

const TIPOS_PERMITIDOS = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);

/**
 * Compone una pieza con el logo que manda el vendedor.
 * No guarda nada: recibe, compone y devuelve.
 */
export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "No disponible" }, { status: 404 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "No se pudo leer el formulario." }, { status: 400 });
  }

  const archivo = form.get("logo");
  const pieceId = String(form.get("pieceId") ?? "").trim();
  const brandName = String(form.get("brandName") ?? "").trim();
  const viewport = String(form.get("viewport") ?? "desktop") as ProposalViewport;

  if (!(archivo instanceof File)) {
    return NextResponse.json({ error: "Falta el logo." }, { status: 400 });
  }
  if (archivo.size > MAX_LOGO_BYTES) {
    return NextResponse.json(
      { error: "El logo pesa más de 5 MB. Probá con uno más liviano." },
      { status: 413 },
    );
  }
  if (!TIPOS_PERMITIDOS.has(archivo.type)) {
    return NextResponse.json(
      { error: "Formato no admitido. Usá PNG, JPG, WEBP o SVG." },
      { status: 415 },
    );
  }
  if (!pieceId) {
    return NextResponse.json({ error: "Falta indicar la pieza." }, { status: 400 });
  }
  if (viewport !== "desktop" && viewport !== "mobile") {
    return NextResponse.json({ error: "Vista inválida." }, { status: 400 });
  }

  try {
    const png = await composePiece({
      pieceId,
      logo: Buffer.from(await archivo.arrayBuffer()),
      brandName,
      viewport,
    });
    return new NextResponse(new Uint8Array(png), {
      headers: {
        "content-type": "image/png",
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    console.error("[propuesta.pieza]", err);
    return NextResponse.json(
      { error: "No se pudo generar la pieza. Probá con otro archivo." },
      { status: 422 },
    );
  }
}
