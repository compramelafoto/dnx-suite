import { NextResponse } from "next/server";
import { composePiece, type ProposalViewport } from "@/lib/propuesta/compose";
import {
  PIECE_LIMIT,
  leerLogoDelFormulario,
  rejectIfRateLimited,
} from "@/lib/propuesta/public-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Compone una pieza con el logo que manda el vendedor.
 * No guarda nada: recibe, compone y devuelve.
 */
export async function POST(request: Request) {
  const frenado = rejectIfRateLimited(request, PIECE_LIMIT);
  if (frenado) return frenado;

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

  const logo = await leerLogoDelFormulario(archivo);
  if (!logo.ok) return logo.response;

  if (!pieceId) {
    return NextResponse.json({ error: "Falta indicar la pieza." }, { status: 400 });
  }
  if (viewport !== "desktop" && viewport !== "mobile") {
    return NextResponse.json({ error: "Vista inválida." }, { status: 400 });
  }

  try {
    const png = await composePiece({
      pieceId,
      logo: logo.buffer,
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
