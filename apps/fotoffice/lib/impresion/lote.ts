import { canonico } from "./canonico";
import { cambiarModo, papelOrientado, type Papel } from "./encuadre";
import { calidadDeCopia, type AvisoCalidad } from "./geometria";
import type { Modo, Receta } from "./receta";
import type { FotoCopia } from "./copias";

/**
 * Módulo PURO de las copias en lote: lo usan el editor (navegador) y `copias.ts` (servidor).
 */

/** Fotos por preparación: más que esto no es una copia instantánea, es un trabajo de laboratorio. */
export const FOTOS_MAX = 60;
/** Copias de una misma foto. */
export const CANTIDAD_MAX = 50;

export type PiezaAGuardar = { originalId: string; cantidad: number; receta: Receta; revisada: boolean };
export type CambioEnLote = { modo?: Modo; cantidad?: number };

export function mismaReceta(a: Receta, b: Receta): boolean {
  return canonico(a) === canonico(b);
}

export function totalDeCopias(fotos: { pieza: { cantidad: number } | null }[]): number {
  return fotos.reduce((s, f) => s + (f.pieza?.cantidad ?? 0), 0);
}

/**
 * Lo que hay que guardar para aplicar un cambio a las fotos elegidas (o a todas si no hay
 * elegidas). Sólo devuelve las que cambian. Nunca marca "Revisada": eso es foto por foto.
 */
export function cambiosEnLote(fotos: FotoCopia[], elegidas: ReadonlySet<string>, cambio: CambioEnLote, papel: Papel): PiezaAGuardar[] {
  const destino = elegidas.size > 0 ? fotos.filter((f) => elegidas.has(f.originalId)) : fotos;
  const out: PiezaAGuardar[] = [];
  for (const f of destino) {
    if (!f.pieza) continue;
    const receta = cambio.modo ? cambiarModo(f.pieza.receta, cambio.modo, { foto: { ancho: f.ancho, alto: f.alto }, papel }) : f.pieza.receta;
    const cantidad = cambio.cantidad ?? f.pieza.cantidad;
    if (receta === f.pieza.receta && cantidad === f.pieza.cantidad) continue;
    out.push({ originalId: f.originalId, receta, cantidad, revisada: false });
  }
  return out;
}

/**
 * Refleja en pantalla lo que el servidor acaba de guardar (misma regla de "Revisada" que
 * `guardarPiezasCopia`). Si cambió la receta o la cantidad, la hoja queda vencida: hay que armarla.
 */
export function aplicarGuardado(fotos: FotoCopia[], items: PiezaAGuardar[], papel: Papel): FotoCopia[] {
  return fotos.map((f) => {
    const it = items.find((i) => i.originalId === f.originalId);
    if (!it) return f;
    const misma = f.pieza !== null && mismaReceta(f.pieza.receta, it.receta);
    const revisada = it.revisada || (misma && (f.pieza?.revisada ?? false));
    const calidad = calidadDeCopia({ ancho: f.ancho, alto: f.alto }, it.receta, papelOrientado(papel, it.receta.orientacion ?? "VERTICAL"));
    const hoja = misma && it.cantidad === f.pieza?.cantidad ? f.hoja : null;
    return { ...f, pieza: { receta: it.receta, cantidad: it.cantidad, revisada, ...calidad }, hoja };
  });
}

/** §5.4: el texto del aviso de calidad, con el nombre del papel. */
export function textoDeAviso(aviso: AvisoCalidad, papel: string): string | null {
  if (aviso === "BLANDA") return `Puede verse algo blanda en ${papel}`;
  if (aviso === "PIXELADA") return `Se va a ver pixelada en ${papel}`;
  return null;
}
