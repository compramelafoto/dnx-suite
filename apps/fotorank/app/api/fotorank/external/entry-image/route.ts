import { loadEntryImageRecord } from "../../../../lib/fotorank/external/entry-image-db";
import { serveEntryImage } from "../../../../lib/fotorank/external/entry-image-service";
import { getPrivateContestStorageProvider } from "../../../../lib/fotorank/storage/provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Imagen de una obra para FOTOFFICE (tienda de obras). Sin sesión: la autorización es la
 * firma HMAC con `DNX_FOTORANK_LINK_SECRET` (ver `entry-image-signing.ts`). FOTOFFICE sólo
 * firma cuando corresponde; acá no se revisan permisos del autor.
 *
 * `variant=preview` → JPEG de 1600 px con marca de agua; `variant=original` → el archivo.
 * Ante cualquier falla, 404 sin detalle (no revela si la obra existe).
 */
export async function GET(req: Request) {
  const query = new URL(req.url).searchParams;
  const result = await serveEntryImage(query, {
    secret: process.env.DNX_FOTORANK_LINK_SECRET,
    now: new Date(),
    loadEntry: loadEntryImageRecord,
    async readObject(key) {
      const storage = getPrivateContestStorageProvider();
      if (!storage.readObject) throw new Error("storage sin lectura");
      return storage.readObject(key);
    },
  });
  if (!result.ok) {
    return new Response("Not found", {
      status: 404,
      headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" },
    });
  }
  return new Response(new Uint8Array(result.body), {
    status: 200,
    headers: {
      ...result.headers,
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
