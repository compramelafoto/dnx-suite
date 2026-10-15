import { NextResponse } from "next/server";
import { hostsDeImagenesPermitidos, urlDeImagenPermitida } from "@/lib/design-v2/imagen-de-plantilla";

export const runtime = "nodejs";

const TOPE_BYTES = 20 * 1024 * 1024;

/**
 * GET ?url= — una imagen de plantilla (fondo, marco, logo) desde nuestro almacenamiento público,
 * servida por nuestro dominio para que la vista 3D la pueda copiar. Ver `imagen-de-plantilla.ts`.
 */
export async function GET(req: Request) {
  const url = urlDeImagenPermitida(new URL(req.url).searchParams.get("url"), hostsDeImagenesPermitidos());
  if (!url) return NextResponse.json({ error: "Imagen no permitida." }, { status: 400 });

  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(20_000), redirect: "error" });
  } catch {
    return NextResponse.json({ error: "No se pudo traer la imagen." }, { status: 502 });
  }
  if (!res.ok) return NextResponse.json({ error: "No se pudo traer la imagen." }, { status: res.status === 404 ? 404 : 502 });
  const tipo = res.headers.get("content-type") ?? "";
  if (!tipo.startsWith("image/")) return NextResponse.json({ error: "No es una imagen." }, { status: 415 });
  const largo = Number(res.headers.get("content-length") ?? 0);
  if (largo > TOPE_BYTES) return NextResponse.json({ error: "Imagen demasiado grande." }, { status: 413 });
  const bytes = await res.arrayBuffer();
  if (bytes.byteLength > TOPE_BYTES) return NextResponse.json({ error: "Imagen demasiado grande." }, { status: 413 });

  return new NextResponse(bytes, {
    headers: {
      "content-type": tipo,
      // Los archivos de plantilla no cambian de contenido: cada subida tiene su propio nombre.
      "cache-control": "public, max-age=86400, s-maxage=604800, immutable",
    },
  });
}
