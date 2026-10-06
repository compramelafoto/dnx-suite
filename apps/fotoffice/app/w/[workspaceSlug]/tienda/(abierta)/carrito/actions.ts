"use server";

import { parseCartLinesInput } from "@/lib/store/cart-lines-input";
import { loadOpenStore, validateCartLines } from "@/lib/store/repository";
import type { CartProblem, ValidatedLine } from "@/lib/store/storefront";

export type ValidateCartResult =
  | { ok: true; lines: ValidatedLine[]; problems: CartProblem[] }
  | { ok: false; error: string };

/**
 * Revalida el carrito del navegador contra el catálogo: precios, talles, stock y máximo por compra.
 * Pública (sin sesión) y sin efectos: no reserva ni escribe nada. Lo que manda el navegador se
 * trata como basura hasta que pasa `parseCartLinesInput`.
 */
export async function validateCartAction(workspaceSlug: unknown, rawLines: unknown): Promise<ValidateCartResult> {
  if (typeof workspaceSlug !== "string" || workspaceSlug.length === 0 || workspaceSlug.length > 100) {
    return { ok: false, error: "La tienda no existe." };
  }
  const store = await loadOpenStore(workspaceSlug);
  if (!store) return { ok: false, error: "La tienda no está disponible en este momento." };

  const lines = parseCartLinesInput(rawLines);
  if (!lines) return { ok: false, error: "No pudimos leer el carrito. Probá vaciarlo y volver a agregar los productos." };

  const r = await validateCartLines(store.workspace.id, lines);
  return { ok: true, ...r };
}
