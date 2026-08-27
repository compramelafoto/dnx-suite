import { NextResponse } from "next/server";
import { buildProposalPdf } from "@/lib/propuesta/pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Tope de subida: un logo razonable no pasa de esto. */
const MAX_LOGO_BYTES = 5 * 1024 * 1024;

const TIPOS_PERMITIDOS = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);

/** Nombre de archivo seguro a partir de la marca. */
function nombreDeArchivo(brandName: string): string {
  const base = brandName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return `propuesta-${base || "marca"}.pdf`;
}

/**
 * Devuelve el dossier en PDF con las piezas compuestas.
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
  const brandName = String(form.get("brandName") ?? "").trim();
  const industry = String(form.get("industry") ?? "").trim();
  const excluidas = form
    .getAll("excludePieceId")
    .map((v) => String(v).trim())
    .filter(Boolean);

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
  if (!brandName) {
    return NextResponse.json({ error: "Falta el nombre de la marca." }, { status: 400 });
  }

  try {
    const pdf = await buildProposalPdf({
      brandName,
      industry: industry || null,
      logo: Buffer.from(await archivo.arrayBuffer()),
      excludePieceIds: excluidas,
      issuedAt: new Date(),
    });

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${nombreDeArchivo(brandName)}"`,
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    console.error("[propuesta.pdf]", err);
    return NextResponse.json(
      { error: "No se pudo armar el PDF. Probá con otro archivo." },
      { status: 422 },
    );
  }
}
