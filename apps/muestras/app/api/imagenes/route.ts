import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getUsuario } from "@/lib/usuario";
import { frenarPorUsuario } from "@/lib/limite";
import { ImagenInvalida, procesarImagen, type UsoImagen } from "@/lib/imagenes/procesar";
import { subirAR2 } from "@/lib/imagenes/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** El navegador ya achica antes de subir; esto frena lo que se escape. Vercel corta en 4,5 MB. */
const MAX_BYTES = 4 * 1024 * 1024;

export async function POST(req: Request) {
  const usuario = await getUsuario();
  if (!usuario) return NextResponse.json({ error: "Tenés que ingresar." }, { status: 401 });
  if (!frenarPorUsuario("imagenes", usuario.id).allowed) {
    return NextResponse.json(
      { error: "Subiste muchas imágenes seguidas. Esperá unos minutos y probá de nuevo." },
      { status: 429 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "No pudimos leer el archivo." }, { status: 400 });
  }
  const file = form.get("file");
  const uso: UsoImagen = form.get("uso") === "portada" ? "portada" : "obra";
  if (!(file instanceof File)) return NextResponse.json({ error: "Falta el archivo." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "La imagen pesa más de 4 MB." }, { status: 413 });

  let img;
  try {
    img = await procesarImagen(Buffer.from(await file.arrayBuffer()), uso);
  } catch (err) {
    if (err instanceof ImagenInvalida) return NextResponse.json({ error: err.message }, { status: 400 });
    console.error("POST /api/imagenes (procesar):", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "No pudimos subir la imagen. Probá de nuevo." }, { status: 500 });
  }

  try {
    const url = await subirAR2(img.bytes, `muestras/${usuario.id}/${randomUUID()}.webp`, img.contentType);
    return NextResponse.json({ url }, { status: 201 });
  } catch (err) {
    // Sólo el mensaje: el objeto completo del SDK de S3 trae cabeceras y metadatos del pedido.
    console.error("POST /api/imagenes (R2):", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "No pudimos subir la imagen. Probá de nuevo." }, { status: 500 });
  }
}
