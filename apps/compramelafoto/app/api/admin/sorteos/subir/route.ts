import { NextRequest, NextResponse } from "next/server";
import { generateR2Key, getR2PublicUrl, uploadToR2 } from "@/lib/r2-client";
import { requireRaffleAdmin } from "../_actor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIPOS = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;
const CARPETAS = { logo: "sorteos/logos", premio: "sorteos/premios", portada: "sorteos/portadas" } as const;

/**
 * POST (multipart) { file, kind: logo | premio | portada } → { url }.
 * Sube a R2 los logos de sponsors, las fotos de los premios y la portada del sorteo.
 * SVG no: se sirve desde el dominio público y podría llevar código.
 */
export async function POST(req: NextRequest) {
  const auth = await requireRaffleAdmin();
  if (!auth.ok) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Elegí una imagen." }, { status: 400 });
  }
  if (!TIPOS.includes(file.type)) {
    return NextResponse.json({ error: "Sólo imágenes JPG, PNG o WebP (para logos, mejor PNG con fondo transparente)." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "La imagen no puede pasar de 5 MB." }, { status: 400 });
  }
  const kind = String(form?.get("kind") ?? "logo") as keyof typeof CARPETAS;
  const carpeta = CARPETAS[kind] ?? CARPETAS.logo;

  try {
    const key = generateR2Key(file.name || "imagen.png", carpeta);
    const { url } = await uploadToR2(Buffer.from(await file.arrayBuffer()), key, file.type, { type: `sorteo_${kind}` });
    return NextResponse.json({ url: url || getR2PublicUrl(key) });
  } catch (e) {
    console.error("POST /api/admin/sorteos/subir", e);
    return NextResponse.json({ error: "No se pudo subir la imagen. Probá de nuevo." }, { status: 500 });
  }
}
