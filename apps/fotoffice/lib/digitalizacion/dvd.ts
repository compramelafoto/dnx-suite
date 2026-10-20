import { BYTES_PEDACITO_DVD } from "./constants";

export type ArchivoDvd = { nombre: string; bytes: number };

const VOB = /^VTS_(\d{2})_(\d)\.VOB$/i;

/** Los VOB de video en el orden en que se reproducen. Los `_0.VOB` son menús y se saltean. */
export function vobsEnOrden<T extends { nombre: string }>(archivos: T[]): T[] {
  return archivos
    .map((a) => ({ a, m: VOB.exec(a.nombre) }))
    .filter((x): x is { a: T; m: RegExpExecArray } => x.m !== null && Number(x.m[2]) >= 1)
    .sort((x, y) => Number(x.m[1]) - Number(y.m[1]) || Number(x.m[2]) - Number(y.m[2]))
    .map((x) => x.a);
}

export function cortesDeArchivo(bytes: number, tam = BYTES_PEDACITO_DVD): { desde: number; hasta: number }[] {
  if (!Number.isFinite(bytes) || !Number.isInteger(tam) || tam <= 0) return [];
  const cortes: { desde: number; hasta: number }[] = [];
  for (let desde = 0; desde < bytes; desde += tam) cortes.push({ desde, hasta: Math.min(bytes, desde + tam) });
  return cortes;
}
