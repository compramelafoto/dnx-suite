import { getUsuario } from "@/lib/usuario";
import { frenarPorUsuario } from "@/lib/limite";
import { imagenAutorizada } from "@/lib/curaduria/imagen";
import { leerDeR2 } from "@/lib/imagenes/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Los ids de obra son uuid: cualquier otra cosa ni llega a la base. */
const ID_VALIDO = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const noEncontrada = () =>
  new Response("No encontrada", {
    status: 404,
    headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });

/**
 * La imagen de una obra enviada, para curadores y organizador, sin revelar su URL: la del bucket
 * lleva el id de quien la subió (`muestras/<userId>/…`). El archivo ya no tiene EXIF (sharp lo
 * descarta al pasar a WebP), así que tampoco viaja el autor de la cámara.
 *
 * Se sirven los bytes: nunca una redirección al bucket. Cualquier negativa (sin sesión, sin
 * permiso, otra convocatoria, obra retirada o inexistente) responde 404: no se confirma que exista.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const usuario = await getUsuario();
  if (!usuario || !ID_VALIDO.test(id)) return noEncontrada();
  if (!frenarPorUsuario("imagenCuraduria", usuario.id).allowed) {
    return new Response("Demasiados pedidos", { status: 429, headers: { "Cache-Control": "private, no-store", "Retry-After": "600" } });
  }
  const url = await imagenAutorizada(id, usuario);
  if (!url) return noEncontrada();
  const archivo = await leerDeR2(url);
  if (!archivo) return noEncontrada();
  // Sólo imágenes: si el objeto viniera con otro tipo, no se sirve.
  const tipo = archivo.contentType.startsWith("image/") ? archivo.contentType : null;
  if (!tipo) {
    await archivo.cuerpo.cancel().catch(() => {});
    return noEncontrada();
  }
  return new Response(archivo.cuerpo, {
    headers: {
      "Content-Type": tipo,
      // Privada: ni el CDN ni un proxy compartido la guardan para otra persona.
      "Cache-Control": "private, max-age=600",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      // Sin nombre de archivo: el nombre del bucket no se filtra ni al guardar la imagen.
      "Content-Disposition": "inline",
    },
  });
}
