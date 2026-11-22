import sharp from "sharp";
import type { StoryCollage } from "./album-story-collages";
import { asignarFotosAHuecos, encuadrarCaras, type CajaDeCara } from "./story-photo-crop";

/**
 * Acomoda cada foto en el hueco que mejor le queda por forma (`asignarFotosAHuecos`) y la
 * recorta a la medida exacta del hueco, sin ampliarla y con las caras adentro
 * (`encuadrarCaras`). Sin caras detectadas, usa la zona de interés de `sharp`
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
  const huecos = Array.from({ length: collage.fotos }, (_, k) =>
    bloques.find((b) => b.type === "image" && b.variableKey === `foto${k + 1}`),
  );

  // 1) Enderezar y achicar cada foto. `rotate()` sin argumentos endereza según EXIF: las
  //    cajas de Rekognition son sobre la foto derecha. Los originales pesan ~8 MB (24 MP):
  //    se achican a 2000 px como máximo, que sobra para cualquier hueco de la historia.
  //    Las cajas de caras son proporciones, así que achicar no las mueve.
  const listas = await Promise.all(
    fotos.map(async (foto) => {
      const { data, info } = await sharp(Buffer.from(foto.bytes), { failOn: "none" })
        .rotate()
        .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })
        .toBuffer({ resolveWithObject: true });
      return { data, w: info.width, h: info.height, caras: foto.caras };
    }),
  );

  // 2) Cada foto al hueco que mejor le queda: verticales a huecos verticales, horizontales
  //    a huecos anchos. Así entra lo más completa posible.
  const orden = asignarFotosAHuecos(
    listas.map((f) => f.w / f.h),
    huecos.map((h) => (h ? h.width / h.height : 1)),
  );

  // 3) Recortar sin ampliar (todo el ancho o todo el alto de la foto), con las caras adentro.
  for (let n = 1; n <= collage.fotos; n++) {
    const hueco = huecos[n - 1];
    const foto = listas[orden[n - 1] ?? -1];
    if (!hueco || !foto) continue;
    const huecoW = Math.max(1, Math.round(hueco.width));
    const huecoH = Math.max(1, Math.round(hueco.height));
    const recorte = encuadrarCaras({ imgW: foto.w, imgH: foto.h, huecoW, huecoH, caras: foto.caras });
    const base = sharp(foto.data, { failOn: "none" });
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
