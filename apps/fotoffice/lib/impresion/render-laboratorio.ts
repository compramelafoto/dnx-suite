import sharp from "sharp";
import { papelOrientado, type Papel } from "./encuadre";
import { cajaRotada, planDeRecorte } from "./geometria";
import { mmAPx } from "./medidas";
import { anguloTotal, type Receta } from "./receta";
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
  const plan = planDeRecorte(receta, caja, destino);
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
    .toBuffer();
}
