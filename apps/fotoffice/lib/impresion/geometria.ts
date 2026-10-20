import { MM_POR_PULGADA } from "./medidas";
import { anguloTotal, type Encuadre, type Receta } from "./receta";

/** Módulo PURO. Las cuentas que tienen que dar igual en la pantalla y en el servidor. */

/** El rectángulo que ocupa una foto girada `grados` (lo mismo que calculan react-easy-crop y sharp). */
export function cajaRotada(ancho: number, alto: number, grados: number): { ancho: number; alto: number } {
  const r = (grados * Math.PI) / 180;
  const c = Math.abs(Math.cos(r));
  const s = Math.abs(Math.sin(r));
  return { ancho: Math.round(ancho * c + alto * s), alto: Math.round(ancho * s + alto * c) };
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * De proporciones a píxeles de una caja concreta. `margen` deja píxeles libres en los bordes:
 * con un giro no múltiplo de 90°, sharp puede redondear la caja un píxel distinto y `extract`
 * fallaría por uno.
 */
export function rectanguloEnPixeles(
  e: Encuadre,
  caja: { ancho: number; alto: number },
  margen = 0,
): { left: number; top: number; width: number; height: number } {
  const W = caja.ancho - margen;
  const H = caja.alto - margen;
  const left = Math.min(Math.max(0, Math.round(e.x * caja.ancho)), W - 1);
  const top = Math.min(Math.max(0, Math.round(e.y * caja.alto)), H - 1);
  const width = Math.max(1, Math.min(W - left, Math.round(e.ancho * caja.ancho)));
  const height = Math.max(1, Math.min(H - top, Math.round(e.alto * caja.alto)));
  return { left, top, width, height };
}

/** De lo que devuelve react-easy-crop (píxeles de la vista previa girada) a proporciones. */
export function encuadreDesdePixeles(
  px: { x: number; y: number; width: number; height: number },
  caja: { ancho: number; alto: number },
): Encuadre {
  const x = clamp01(px.x / caja.ancho);
  const y = clamp01(px.y / caja.alto);
  return { x, y, ancho: clamp01(Math.min(px.width / caja.ancho, 1 - x)), alto: clamp01(Math.min(px.height / caja.alto, 1 - y)) };
}

/** Píxeles reales del original que caen en cada pulgada del papel (el lado más débil). */
export function resolucionEfectiva(px: { width: number; height: number }, mm: { anchoMm: number; altoMm: number }): number {
  return Math.round(Math.min(px.width / (mm.anchoMm / MM_POR_PULGADA), px.height / (mm.altoMm / MM_POR_PULGADA)));
}

export type AvisoCalidad = "OK" | "BLANDA" | "PIXELADA";

export function avisoDeCalidad(ppp: number): AvisoCalidad {
  if (ppp >= 200) return "OK";
  if (ppp >= 150) return "BLANDA";
  return "PIXELADA";
}

export const LADO_VISTA_PREVIA = 1600;

/**
 * La medida de la vista previa de un original (ya derecho): el lado mayor a 1600 px, sin agrandar
 * fotos chicas. `generarVistaPrevia` achica exactamente a esto, así se puede saber la medida sin
 * volver a leer el archivo.
 */
export function tamanoVistaPrevia(ancho: number, alto: number): { ancho: number; alto: number } {
  const escala = Math.min(1, LADO_VISTA_PREVIA / Math.max(ancho, alto));
  return { ancho: Math.max(1, Math.round(ancho * escala)), alto: Math.max(1, Math.round(alto * escala)) };
}

export type Rect = { left: number; top: number; width: number; height: number };

/** La parte del encuadre que cae dentro de la foto (0..1), o null si no la toca. */
export function interseccionConFoto(e: Encuadre): Encuadre | null {
  const x0 = Math.max(0, e.x);
  const y0 = Math.max(0, e.y);
  const x1 = Math.min(1, e.x + e.ancho);
  const y1 = Math.min(1, e.y + e.alto);
  if (x1 - x0 <= 0 || y1 - y0 <= 0) return null;
  return { x: x0, y: y0, ancho: x1 - x0, alto: y1 - y0 };
}

const entre = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

/**
 * Qué píxeles de la caja girada se toman (`recorte`) y dónde van en el destino (`colocacion`).
 * RECORTAR: el encuadre entero a todo el destino (lo mismo que hacía la etapa 1). ENCAJAR: sólo
 * la parte del encuadre que cae en la foto, en su lugar del papel; el resto es borde.
 * La usan el servidor (`renderizarPieza`) y la vista previa (`VistaPieza`), así coinciden.
 */
export function planDeRecorte(
  r: Pick<Receta, "modo" | "encuadre">,
  caja: { ancho: number; alto: number },
  destino: { ancho: number; alto: number },
  margen = 0,
): { recorte: Rect; colocacion: Rect; completo: boolean } {
  const e = r.encuadre;
  if (r.modo === "RECORTAR") {
    return { recorte: rectanguloEnPixeles(e, caja, margen), colocacion: { left: 0, top: 0, width: destino.ancho, height: destino.alto }, completo: true };
  }
  // `validarReceta` no deja pasar un encuadre que no toque la foto; por las dudas, la foto entera.
  const i = interseccionConFoto(e) ?? { x: 0, y: 0, ancho: 1, alto: 1 };
  const left = entre(Math.round(((i.x - e.x) / e.ancho) * destino.ancho), 0, destino.ancho - 1);
  const right = entre(Math.round(((i.x + i.ancho - e.x) / e.ancho) * destino.ancho), left + 1, destino.ancho);
  const top = entre(Math.round(((i.y - e.y) / e.alto) * destino.alto), 0, destino.alto - 1);
  const bottom = entre(Math.round(((i.y + i.alto - e.y) / e.alto) * destino.alto), top + 1, destino.alto);
  const colocacion = { left, top, width: right - left, height: bottom - top };
  return {
    recorte: rectanguloEnPixeles(i, caja, margen),
    colocacion,
    completo: left === 0 && top === 0 && colocacion.width === destino.ancho && colocacion.height === destino.alto,
  };
}

/**
 * §5.4 para una copia: píxeles reales del original que caen en cada pulgada del lugar que ocupa
 * la foto en el papel (`papel` ya orientado como la receta). Se calcula en décimas de mm.
 */
export function calidadDeCopia(
  foto: { ancho: number; alto: number },
  r: Receta,
  papel: { anchoMm: number; altoMm: number },
): { ppp: number; aviso: AvisoCalidad } {
  const caja = cajaRotada(foto.ancho, foto.alto, anguloTotal(r));
  const plan = planDeRecorte(r, caja, { ancho: Math.round(papel.anchoMm * 10), alto: Math.round(papel.altoMm * 10) });
  const ppp = resolucionEfectiva(plan.recorte, { anchoMm: plan.colocacion.width / 10, altoMm: plan.colocacion.height / 10 });
  return { ppp, aviso: avisoDeCalidad(ppp) };
}
