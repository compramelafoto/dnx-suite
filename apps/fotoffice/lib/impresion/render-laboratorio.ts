import sharp from "sharp";
import { papelOrientado, type Papel } from "./encuadre";
import { cajaRotada, planDeRecorte } from "./geometria";
import { mmAPx } from "./medidas";
import { anguloTotal, type Receta } from "./receta";
import { MODO_DOBLEZ_POR_OMISION, doblezEnPx } from "./cuadros";
import { leerOriginal, renderizarPieza } from "./render";

/**
 * El archivo que se manda al laboratorio: la medida real del papel a 300 ppp (nunca más píxeles de
 * los que da el original para ese encuadre) con la receta completa de la cajera. Módulo de servidor.
 */

export const PPP_LABORATORIO = 300;

/**
 * Píxeles de salida: la medida real (en la orientación de la receta) a 300 ppp, achicada en proporción si
 * el encuadre del original da menos píxeles. Pura.
 */
export function pixelesParaLaboratorio(papel: Papel, receta: Receta, original: { ancho: number; alto: number }): { ancho: number; alto: number } {
  const orientado = papelOrientado(papel, receta.orientacion ?? "VERTICAL");
  const destino = { ancho: mmAPx(orientado.anchoMm, PPP_LABORATORIO), alto: mmAPx(orientado.altoMm, PPP_LABORATORIO) };
  const caja = cajaRotada(original.ancho, original.alto, anguloTotal(receta));
  // El mismo margen que usa `renderizarPieza`.
  const plan = planDeRecorte(receta, caja, destino, anguloTotal(receta) % 90 === 0 ? 0 : 2);
  const escala = Math.min(1, plan.recorte.width / plan.colocacion.width, plan.recorte.height / plan.colocacion.height);
  if (escala >= 1) return destino;
  return { ancho: Math.max(1, Math.min(destino.ancho, Math.floor(destino.ancho * escala + 1e-6))), alto: Math.max(1, Math.min(destino.alto, Math.floor(destino.alto * escala + 1e-6))) };
}

/** `renderizarPieza` con la receta de la cajera, guardado como JPEG q95, 4:4:4, sRGB. */
export async function renderParaLaboratorio(original: Buffer, receta: Receta, papel: Papel): Promise<Buffer> {
  const info = await leerOriginal(original);
  const destino = pixelesParaLaboratorio(papel, receta, { ancho: info.ancho, alto: info.alto });
  const pieza = await renderizarPieza(original, receta, destino, receta.nitidez ?? "NORMAL");
  return sharp(pieza.data, { raw: { width: pieza.ancho, height: pieza.alto, channels: 3 } })
    .toColourspace("srgb")
    .jpeg({ quality: 95, chromaSubsampling: "4:4:4" })
    .withIccProfile("srgb")
    .withMetadata({ density: PPP_LABORATORIO })
    .toBuffer();
}

/**
 * El archivo de un cuadro (canvas o MDF): al frente ya armado se le agrega el doblez de 5 cm por
 * lado para envolver el bastidor o la placa. Cómo se rellena lo dice la receta:
 * - ESPEJO: el borde de la foto reflejado (no se pierde nada del frente);
 * - DESENFOCADO: la foto agrandada y borrosa detrás del frente;
 * - COLOR: un color parejo (blanco si no se eligió);
 * - ENVOLVENTE: la foto entera agrandada al total: dobla sobre el lateral y pierde 5 cm de cada borde.
 * `anchoMm` es el ancho del frente en la orientación de la receta.
 */
export async function agregarDoblez(frente: Buffer, receta: Receta, papel: Papel): Promise<Buffer> {
  const meta = await sharp(frente).metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  if (!w || !h) throw new Error("el frente del cuadro no tiene medidas");
  const orientado = papelOrientado(papel, receta.orientacion ?? "VERTICAL");
  const e = doblezEnPx(w, orientado.anchoMm);
  const total = { w: w + 2 * e, h: h + 2 * e };
  const modo = receta.doblez ?? MODO_DOBLEZ_POR_OMISION;
  let lienzo: sharp.Sharp;
  if (modo === "ESPEJO") lienzo = sharp(frente).extend({ top: e, bottom: e, left: e, right: e, extendWith: "mirror" });
  else if (modo === "COLOR") lienzo = sharp(frente).extend({ top: e, bottom: e, left: e, right: e, background: receta.colorDoblez ?? "#ffffff" });
  else if (modo === "ENVOLVENTE") lienzo = sharp(frente).resize(total.w, total.h, { fit: "cover" });
  else {
    const fondo = await sharp(frente).resize(total.w, total.h, { fit: "fill" }).blur(40).toBuffer();
    lienzo = sharp(fondo).composite([{ input: frente, left: e, top: e }]);
  }
  return sharp(await lienzo.toBuffer())
    .toColourspace("srgb")
    .jpeg({ quality: 95, chromaSubsampling: "4:4:4" })
    .withIccProfile("srgb")
    .withMetadata({ density: PPP_LABORATORIO })
    .toBuffer();
}
