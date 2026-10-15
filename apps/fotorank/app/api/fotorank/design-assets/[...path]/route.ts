import { NextResponse } from "next/server";
import { readPrivateObject } from "../../../../lib/fotorank/storage/provider";
import {
  contentTypeForAsset,
  designAssetKeyFromSegments,
} from "../../../../lib/fotorank/design/asset-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ path: string[] }> };

/**
 * GET /api/fotorank/design-assets/{templateId}/{versionId}/{archivo}
 *
 * Las imágenes que se subieron dentro del diseñador (fondo, logo, firma). Viven en el
 * almacenamiento privado y salen por acá: no son sensibles y el nombre es un UUID, así que no
 * se pide sesión —el lienzo del editor y los diplomas emitidos las tienen que poder cargar—.
 * Sólo se sirve lo que está bajo el prefijo del diseñador; cualquier otra forma es un 404.
 */
export async function GET(_req: Request, ctx: Ctx) {
  const { path } = await ctx.params;
  const key = designAssetKeyFromSegments(path ?? []);
  if (!key) return NextResponse.json({ error: "No encontrado." }, { status: 404 });

  try {
    const bytes = await readPrivateObject(key);
    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": contentTypeForAsset(path[path.length - 1] ?? ""),
        // El nombre no cambia nunca de contenido: cada subida es un archivo nuevo.
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
        // Un SVG subido no puede ejecutar nada si se abre suelto.
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      },
    });
  } catch {
    return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  }
}
