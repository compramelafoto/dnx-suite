import sharp from "sharp";
import type { StoryCollage } from "./album-story-collages";
import { encuadrarCaras, type CajaDeCara } from "./story-photo-crop";

/**
 * Recorta cada foto elegida a la medida exacta de su hueco en el collage, con las caras
 * adentro (`encuadrarCaras`). Sin caras detectadas, usa la zona de interés de `sharp`
 * (busca lo más contrastado y saturado, que suele ser la gente).
 *
 * Devuelve, por cada `fotoN` de la plantilla, una referencia `slot:N` y sus bytes: así el
 * Designer recibe la foto ya encuadrada y su `cover` no vuelve a recortar nada.
 */
export async function prepararFotosDelCollage(
  collage: StoryCollage,
  fotos: Array<{ bytes: Uint8Array; caras: CajaDeCara[] }>,
): Promise<{ values: Record<string, string>; slots: Map<string, Uint8Array> }> {
  const values: Record<string, string> = {};
  const slots = new Map<string, Uint8Array>();
  const bloques = collage.document.sides[0]!.blocks;

  for (let n = 1; n <= collage.fotos; n++) {
    const hueco = bloques.find((b) => b.type === "image" && b.variableKey === `foto${n}`);
    const foto = fotos[n - 1];
    if (!hueco || !foto) continue;
    const huecoW = Math.max(1, Math.round(hueco.width));
    const huecoH = Math.max(1, Math.round(hueco.height));

    // `rotate()` sin argumentos endereza según EXIF: las cajas de Rekognition son sobre la
    // foto derecha.
    // Los originales pesan ~8 MB (24 MP): se achican primero a 2000 px como máximo, que
    // sobra para cualquier hueco de la historia (1080 de ancho). Las cajas de caras son
    // proporciones, así que achicar no las mueve.
    const derecha = sharp(Buffer.from(foto.bytes), { failOn: "none" })
      .rotate()
      .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true });
    const { data, info } = await derecha.toBuffer({ resolveWithObject: true });
    const recorte = encuadrarCaras({ imgW: info.width, imgH: info.height, huecoW, huecoH, caras: foto.caras });

    const base = sharp(data, { failOn: "none" });
    const salida = recorte
      ? base.extract(recorte).resize(huecoW, huecoH, { fit: "fill" })
      : base.resize(huecoW, huecoH, { fit: "cover", position: sharp.strategy.attention });
    const bytes = new Uint8Array(await salida.jpeg({ quality: 90 }).toBuffer());

    const ref = `slot:${n}`;
    slots.set(ref, bytes);
    values[`foto${n}`] = ref;
  }
  return { values, slots };
}
