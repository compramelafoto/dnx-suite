import { loadEntryImageRecord } from "../../../../lib/fotorank/external/entry-image-db";
import { serveEntryImage } from "../../../../lib/fotorank/external/entry-image-service";
import { getPrivateContestStorageProvider } from "../../../../lib/fotorank/storage/provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CABECERAS_COMUNES = { "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex, nofollow" };

/**
 * Imagen de una obra para FOTOFFICE (tienda de obras). Sin sesión: la autorización es la
 * firma HMAC con `DNX_FOTORANK_LINK_SECRET` (ver `entry-image-signing.ts`). FOTOFFICE sólo
 * firma cuando corresponde; acá no se revisan permisos del autor.
 *
 * `variant=preview` → JPEG de 1600 px con marca de agua; `variant=original` → redirección a
 * una descarga directa de R2 de 120 s (o los bytes, con storage local en desarrollo).
 * Ante cualquier falla, 404 sin detalle (no revela si la obra existe).
 */
export async function GET(req: Request) {
  const query = new URL(req.url).searchParams;
  let storage: ReturnType<typeof getPrivateContestStorageProvider> | null = null;
  try {
    storage = getPrivateContestStorageProvider();
  } catch {
    storage = null;
  }
  const result = await serveEntryImage(query, {
    // eslint-disable-next-line turbo/no-undeclared-env-vars -- secreto de runtime, no afecta el build
    secret: process.env.DNX_FOTORANK_LINK_SECRET,
    now: new Date(),
    loadEntry: loadEntryImageRecord,
    async readObject(key) {
      if (!storage?.readObject) throw new Error("storage sin lectura");
      return storage.readObject(key);
    },
    presignDownload: storage?.presignDownload ? storage.presignDownload.bind(storage) : undefined,
  });
  if (!result.ok) {
    return new Response("Not found", {
      status: 404,
      headers: { "Cache-Control": "no-store", ...CABECERAS_COMUNES },
    });
  }
  if (result.kind === "redirect") {
    return new Response(null, {
      status: 302,
      headers: { ...result.headers, Location: result.location, ...CABECERAS_COMUNES },
    });
  }
  return new Response(new Uint8Array(result.body), {
    status: 200,
    headers: { ...result.headers, ...CABECERAS_COMUNES },
  });
}
