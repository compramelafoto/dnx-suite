import sharp from "sharp";
import { computeCoverCropRect } from "@repo/template-editor-core";
import type { DesignV2Data } from "./design-data";

/** Lado máximo de una foto ya recortada: más que eso no suma nada a 300 dpi en una carpeta. */
const MAX_PHOTO_SIDE_PX = 4000;

/**
 * La foto del cliente recortada a su hueco, a la resolución del hueco (sin agrandar).
 *
 * Si la familia alejó la foto para que entre entera (zoom < 1), el recorte es más grande que la
 * foto: lo que falta se completa con blanco (transparente en un recorte sin fondo), con la misma
 * cuenta que la pantalla.
 */
export async function cropPhotoForSlot(input: {
  bytes: Uint8Array;
  slotWidth: number;
  slotHeight: number;
  crop: DesignV2Data["slots"][string]["crop"];
  /** Un recorte sin fondo: sale en PNG para conservar la transparencia. */
  transparente?: boolean;
}): Promise<Uint8Array> {
  const rotated = await sharp(input.bytes, { failOn: "none" })
    .rotate()
    .toBuffer({ resolveWithObject: true });
  const W = rotated.info.width;
  const H = rotated.info.height;
  const rect = computeCoverCropRect({
    srcWidth: W,
    srcHeight: H,
    slotWidth: input.slotWidth,
    slotHeight: input.slotHeight,
    crop: input.crop,
  });
  const encode = (img: sharp.Sharp) =>
    img[input.transparente ? "png" : "jpeg"](input.transparente ? { compressionLevel: 9 } : { quality: 90, mozjpeg: true }).toBuffer();

  const conBordes = rect.left < -0.5 || rect.top < -0.5 || rect.left + rect.width > W + 0.5 || rect.top + rect.height > H + 0.5;
  if (!conBordes) {
    const left = Math.max(0, Math.round(rect.left));
    const top = Math.max(0, Math.round(rect.top));
    const width = Math.max(1, Math.min(W - left, Math.round(rect.width)));
    const height = Math.max(1, Math.min(H - top, Math.round(rect.height)));

    const targetWidth = Math.min(width, Math.round(input.slotWidth), MAX_PHOTO_SIDE_PX);
    const out = await encode(
      sharp(rotated.data)
        .extract({ left, top, width, height })
        .resize({ width: Math.max(1, targetWidth), withoutEnlargement: true }),
    );
    return new Uint8Array(out);
  }

  // Lo que se ve de la foto (la parte del recorte que cae dentro de ella)…
  const ix0 = Math.max(0, rect.left);
  const iy0 = Math.max(0, rect.top);
  const ix1 = Math.min(W, rect.left + rect.width);
  const iy1 = Math.min(H, rect.top + rect.height);
  // …a la escala final: el lado más largo del recorte sin pasar del hueco ni agrandar la foto.
  const s = Math.min(1, input.slotWidth / rect.width, MAX_PHOTO_SIDE_PX / rect.width);
  const outW = Math.max(1, Math.round(rect.width * s));
  const outH = Math.max(1, Math.round(rect.height * s));
  const visible = {
    left: Math.max(0, Math.floor(ix0)),
    top: Math.max(0, Math.floor(iy0)),
    width: Math.max(1, Math.min(W - Math.floor(ix0), Math.round(ix1 - ix0))),
    height: Math.max(1, Math.min(H - Math.floor(iy0), Math.round(iy1 - iy0))),
  };
  const offX = Math.min(outW - 1, Math.max(0, Math.round((ix0 - rect.left) * s)));
  const offY = Math.min(outH - 1, Math.max(0, Math.round((iy0 - rect.top) * s)));
  const fotoW = Math.max(1, Math.min(outW - offX, Math.round(visible.width * s)));
  const fotoH = Math.max(1, Math.min(outH - offY, Math.round(visible.height * s)));
  const foto = await sharp(rotated.data)
    .extract(visible)
    .resize({ width: fotoW, height: fotoH, fit: "fill" })
    .toBuffer();
  const fondo = input.transparente ? { r: 255, g: 255, b: 255, alpha: 0 } : { r: 255, g: 255, b: 255, alpha: 1 };
  const out = await encode(
    sharp({ create: { width: outW, height: outH, channels: 4, background: fondo } })
      .composite([{ input: foto, left: offX, top: offY }])
      .flatten(input.transparente ? false : { background: "#ffffff" }),
  );
  return new Uint8Array(out);
}
