import "server-only";
import sharp from "sharp";
import { dimensionesRotadas, normalizarEncuadre } from "./encuadre";
import { origenTrasGirar, planDeSalida, type RecetaProbador } from "./salida";

/**
 * El archivo de un cuadro del probador para el laboratorio, con sharp, siguiendo `planDeSalida`:
 *   1. endereza por EXIF y aplica el giro de 90° del encuadre;
 *   2. lee sólo la región que hace falta y la lleva a la escala de salida;
 *   3. la inclina `theta` (sharp gira sobre el centro y agranda el lienzo) y recorta el frente;
 *   4. en el canvas, la envoltura: el mismo frente agrandado hasta el borde y desenfocado, con el
 *      frente nítido encima. Así el costado del bastidor tiene el color de la foto y nunca queda
 *      negro ni corta nada del frente.
 * Sale en sRGB, JPEG 95 4:4:4, con la resolución anotada.
 */

sharp.cache(false);
const MAX_PIXELES = 200_000_000;

export function esRecetaProbador(v: unknown): v is RecetaProbador {
  const r = v as RecetaProbador | null;
  return !!r && typeof r === "object" && typeof r.tipo === "string" && !!r.marco && !!r.ventana && !!r.encuadre;
}

export async function renderProbador(original: Buffer, receta: RecetaProbador): Promise<Buffer> {
  const derecha = await sharp(original, { limitInputPixels: MAX_PIXELES }).rotate().toBuffer({ resolveWithObject: true });
  const foto = { w: derecha.info.width, h: derecha.info.height };
  // El encuadre se vuelve a ajustar con las medidas reales: nunca se lee fuera de la foto.
  const r = { ...receta, encuadre: normalizarEncuadre(receta.encuadre, receta.marco, foto) };
  const plan = planDeSalida(r, foto);
  const girada90 = dimensionesRotadas(foto, r.encuadre.rot90);

  let img = sharp(derecha.data, { limitInputPixels: MAX_PIXELES });
  if (r.encuadre.rot90) img = sharp(await img.rotate(r.encuadre.rot90).toBuffer(), { limitInputPixels: MAX_PIXELES });
  const reg = plan.region;
  const ancho = Math.max(1, Math.round(reg.width * plan.escala)), alto = Math.max(1, Math.round(reg.height * plan.escala));
  const escalada = await img
    .extract({ left: reg.left, top: reg.top, width: Math.min(reg.width, girada90.w - reg.left), height: Math.min(reg.height, girada90.h - reg.top) })
    .resize(ancho, alto, { fit: "fill", kernel: "lanczos3" })
    .toBuffer({ resolveWithObject: true });
  const escalaReal = { x: escalada.info.width / reg.width, y: escalada.info.height / reg.height };

  let fuente = escalada.data, dims = { w: escalada.info.width, h: escalada.info.height };
  if (Math.abs(plan.theta) > 1e-6) {
    const girada = await sharp(escalada.data).rotate((plan.theta * 180) / Math.PI, { background: { r: 255, g: 255, b: 255 } }).toBuffer({ resolveWithObject: true });
    fuente = girada.data;
    dims = { w: girada.info.width, h: girada.info.height };
  }
  const o = origenTrasGirar(plan.origen, escalaReal, plan.theta, { w: escalada.info.width, h: escalada.info.height }, Math.abs(plan.theta) > 1e-6 ? dims : { w: escalada.info.width, h: escalada.info.height });
  const left = Math.min(Math.max(0, Math.round(o.x)), Math.max(0, dims.w - plan.frente.w));
  const top = Math.min(Math.max(0, Math.round(o.y)), Math.max(0, dims.h - plan.frente.h));
  const frente = await sharp(fuente)
    .extract({ left, top, width: Math.min(plan.frente.w, dims.w - left), height: Math.min(plan.frente.h, dims.h - top) })
    .resize(plan.frente.w, plan.frente.h, { fit: "fill" })
    .toBuffer();

  const salida = plan.envoltura > 0
    ? sharp(await sharp(frente).resize(plan.total.w, plan.total.h, { fit: "fill" }).blur(40).toBuffer())
        .composite([{ input: frente, left: plan.envoltura, top: plan.envoltura }])
    : sharp(frente);
  return salida.toColorspace("srgb").withMetadata({ density: plan.ppp }).jpeg({ quality: 95, chromaSubsampling: "4:4:4" }).toBuffer();
}
