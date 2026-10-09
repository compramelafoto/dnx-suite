import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getUsuario } from "@/lib/usuario";
import { procesarImagen, type UsoImagen } from "@/lib/imagenes/procesar";
import { subirAR2 } from "@/lib/imagenes/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** El navegador ya achica antes de subir; esto frena lo que se escape. Vercel corta en 4,5 MB. */
const MAX_BYTES = 4 * 1024 * 1024;

export async function POST(req: Request) {
  const usuario = await getUsuario();
  if (!usuario) return NextResponse.json({ error: "Tenés que ingresar." }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  const uso: UsoImagen = form.get("uso") === "portada" ? "portada" : "obra";
  if (!(file instanceof File)) return NextResponse.json({ error: "Falta el archivo." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "La imagen pesa más de 4 MB." }, { status: 413 });

  try {
    const img = await procesarImagen(Buffer.from(await file.arrayBuffer()), uso);
    const url = await subirAR2(img.bytes, `muestras/${usuario.id}/${randomUUID()}.webp`, img.contentType);
    return NextResponse.json({ url }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "No pudimos subir la imagen.";
    console.error("POST /api/imagenes:", err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
