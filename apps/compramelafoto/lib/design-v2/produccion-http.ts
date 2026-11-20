import { NextResponse } from "next/server";
import { ProduccionError } from "./produccion";

/** Lista de ids positivos de un arreglo o de un texto «1,2,3». */
export function listaDeIds(input: unknown): number[] {
  const crudos = Array.isArray(input) ? input : typeof input === "string" ? input.split(",") : [];
  return [...new Set(crudos.map((v) => Number(String(v).trim())).filter((n) => Number.isInteger(n) && n > 0))];
}

/**
 * `?ids=1,2,3`, `?copias=4,5` y `?lote=Lote 3 · 14/10` de la consulta, o del cuerpo JSON. `ids` son
 * libritos (diseños) y `copias` pedidos de canje de sólo copias impresas.
 */
export function filtroDeLibritos(input: { ids?: unknown; lote?: unknown; copias?: unknown }): {
  ids?: number[];
  lote?: string;
  copias?: number[];
} {
  const lote = typeof input.lote === "string" && input.lote.trim() ? input.lote.trim().slice(0, 120) : undefined;
  const ids = listaDeIds(input.ids);
  const copias = listaDeIds(input.copias);
  return { ...(ids.length ? { ids } : {}), ...(lote ? { lote } : {}), ...(copias.length ? { copias } : {}) };
}

export function respuestaDeError(err: unknown, contexto: string) {
  if (err instanceof ProduccionError) return NextResponse.json({ error: err.message }, { status: err.status });
  console.error(`[produccion] ${contexto}`, err);
  return NextResponse.json({ error: "No pudimos completar la operación. Probá de nuevo." }, { status: 500 });
}
