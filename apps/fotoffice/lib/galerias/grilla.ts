/**
 * Lógica de la grilla de fotos del estudio (módulo PURO): fusionar lo que llega del servidor, ordenar
 * y mover. Trabaja con un tipo mínimo para no depender del resto.
 */
import { ordenarFotosDeGaleria } from "./orden";
import type { EstadoFoto, ModoOrden } from "./constantes";

export type FotoDeGrilla = {
  id: string;
  fileName: string;
  status: EstadoFoto;
  order: number;
};

/** Reemplaza las fotos que ya estaban (por id), agrega las nuevas y deja todo en el orden del modo. */
export function fusionarFotos<T extends FotoDeGrilla>(actuales: readonly T[], nuevas: readonly T[], modo: ModoOrden): T[] {
  const porId = new Map<string, T>();
  for (const f of actuales) porId.set(f.id, f);
  for (const f of nuevas) porId.set(f.id, f);
  return ordenarFotosDeGaleria([...porId.values()], modo);
}

/** Cada foto con `order` = su posición (0, 1, 2…). Es lo que queda guardado tras un orden manual. */
export function reasignarOrden<T extends FotoDeGrilla>(fotos: readonly T[]): T[] {
  return fotos.map((f, i) => (f.order === i ? f : { ...f, order: i }));
}

/** Mueve una foto a la posición `destino` (0 = primera). Devuelve la misma lista si no hay cambio. */
export function moverFoto<T extends { id: string }>(fotos: readonly T[], id: string, destino: number): T[] {
  const desde = fotos.findIndex((f) => f.id === id);
  if (desde < 0) return [...fotos];
  const hasta = Math.max(0, Math.min(destino, fotos.length - 1));
  if (hasta === desde) return [...fotos];
  const copia = [...fotos];
  const [f] = copia.splice(desde, 1);
  copia.splice(hasta, 0, f);
  return copia;
}

/** Mueve una foto antes (-1) o después (+1) de su lugar. */
export function moverUnLugar<T extends { id: string }>(fotos: readonly T[], id: string, paso: -1 | 1): T[] {
  const desde = fotos.findIndex((f) => f.id === id);
  return desde < 0 ? [...fotos] : moverFoto(fotos, id, desde + paso);
}

/** Mueve `id` a la posición que hoy ocupa `antesDe` (soltar una foto sobre otra). */
export function moverAntesDe<T extends { id: string }>(fotos: readonly T[], id: string, antesDe: string): T[] {
  if (id === antesDe) return [...fotos];
  const destino = fotos.findIndex((f) => f.id === antesDe);
  return destino < 0 ? [...fotos] : moverFoto(fotos, id, destino);
}
