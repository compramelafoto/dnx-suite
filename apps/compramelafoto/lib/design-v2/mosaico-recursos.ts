import sharp from "sharp";
import { SCHOOL_CLIENT_PHOTO_PLACEHOLDER } from "@repo/template-engine";

/**
 * Las fotos de los compañeros del «Mosaico del curso» al imprimir.
 *
 * El puente las marca con un prefijo propio: `mosaic-photo:<id>` (una foto del álbum) o
 * `mosaic-url:<dirección>` (una foto de demo). Se achican a un lado mayor de 1200 px —son
 * recuadros chicos— y el encuadre lo aplica design-studio.
 *
 * Si una foto no aparece (se borró, la red falló, los bytes están rotos) va la silueta gris, la
 * misma que la de un chico sin foto. design-studio no emite la pieza si le falta un recurso, y un
 * compañero sin foto no puede frenar la carpeta entera.
 */

const PREFIJO_FOTO = "mosaic-photo:";
const PREFIJO_URL = "mosaic-url:";
const LADO_MAXIMO_PX = 1200;

export type CargadoresDelMosaico = {
  cargarFoto: (photoId: number) => Promise<Uint8Array | null>;
  cargarUrl: (url: string) => Promise<Uint8Array | null>;
};

let silueta: Promise<Uint8Array> | null = null;

function bytesDeSilueta(): Promise<Uint8Array> {
  silueta ??= (async () => {
    const coma = SCHOOL_CLIENT_PHOTO_PLACEHOLDER.indexOf(",");
    const png = Buffer.from(SCHOOL_CLIENT_PHOTO_PLACEHOLDER.slice(coma + 1), "base64");
    return new Uint8Array(await sharp(png).resize(300, 400, { fit: "fill" }).png().toBuffer());
  })();
  return silueta;
}

async function achicar(bytes: Uint8Array): Promise<Uint8Array> {
  const out = await sharp(bytes, { failOn: "none" })
    .rotate()
    .resize({ width: LADO_MAXIMO_PX, height: LADO_MAXIMO_PX, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
  return new Uint8Array(out);
}

/**
 * Los bytes de una foto del mosaico, la silueta si no se pudo conseguir, o `undefined` si la
 * referencia no es del mosaico (la resuelve quien llama).
 */
export async function leerRecursoDelMosaico(
  ref: string,
  cargadores: CargadoresDelMosaico,
): Promise<Uint8Array | undefined> {
  let pendiente: Promise<Uint8Array | null>;
  if (ref.startsWith(PREFIJO_FOTO)) {
    const id = Number(ref.slice(PREFIJO_FOTO.length));
    pendiente = Number.isInteger(id) && id > 0 ? cargadores.cargarFoto(id) : Promise.resolve(null);
  } else if (ref.startsWith(PREFIJO_URL)) {
    pendiente = cargadores.cargarUrl(ref.slice(PREFIJO_URL.length));
  } else {
    return undefined;
  }
  try {
    const bytes = await pendiente;
    if (bytes && bytes.length > 0) return await achicar(bytes);
  } catch {
    // Cae a la silueta.
  }
  return bytesDeSilueta();
}
