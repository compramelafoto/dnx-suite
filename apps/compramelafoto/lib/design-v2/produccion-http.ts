import { NextResponse } from "next/server";
import { ProduccionError } from "./produccion";

/** `?ids=1,2,3` y `?lote=Lote 3 · 14/10` de la consulta, o del cuerpo JSON. */
export function filtroDeLibritos(input: { ids?: unknown; lote?: unknown }): { ids?: number[]; lote?: string } {
  const lote = typeof input.lote === "string" && input.lote.trim() ? input.lote.trim().slice(0, 120) : undefined;
  const crudos = Array.isArray(input.ids) ? input.ids : typeof input.ids === "string" ? input.ids.split(",") : [];
  const ids = [...new Set(crudos.map((v) => Number(String(v).trim())).filter((n) => Number.isInteger(n) && n > 0))];
  return { ...(ids.length ? { ids } : {}), ...(lote ? { lote } : {}) };
}

export function respuestaDeError(err: unknown, contexto: string) {
  if (err instanceof ProduccionError) return NextResponse.json({ error: err.message }, { status: err.status });
  console.error(`[produccion] ${contexto}`, err);
  return NextResponse.json({ error: "No pudimos completar la operación. Probá de nuevo." }, { status: 500 });
}
