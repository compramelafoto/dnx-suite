/**
 * Bloque de un rubro según su código (etapa 6). Módulo PURO.
 *
 * `3…` = Ingresos, `4…` = Costos, `5…` = Gastos. Cualquier otra cosa (sin código, otro primer
 * dígito) es "sin clasificar".
 */

export type BloqueResultado = "INGRESOS" | "COSTOS" | "GASTOS";

export function bloqueDeCodigo(codigo: string | null): BloqueResultado | null {
  if (codigo === null) return null;
  const c = codigo.trim();
  if (c.startsWith("3")) return "INGRESOS";
  if (c.startsWith("4")) return "COSTOS";
  if (c.startsWith("5")) return "GASTOS";
  return null;
}

/** Lo mínimo de un rubro para decidir su bloque. */
export type RubroBloque = { id: string; codigo: string | null; parentId: string | null };

/**
 * Bloque de un rubro: el de su código, o el del padre si el hijo no tiene código propio.
 * Un hijo con código propio usa el suyo (aunque el del padre diga otra cosa).
 */
export function bloqueDeRubro(rubro: RubroBloque, porId: ReadonlyMap<string, RubroBloque>): BloqueResultado | null {
  const propio = rubro.codigo?.trim() ? rubro.codigo : null;
  if (propio !== null) return bloqueDeCodigo(propio);
  const padre = rubro.parentId && rubro.parentId !== rubro.id ? porId.get(rubro.parentId) : undefined;
  return padre ? bloqueDeCodigo(padre.codigo?.trim() ? padre.codigo : null) : null;
}

/** Un bloque de egreso (costos, gastos) o de ingreso. */
export function ladoDeBloque(bloque: BloqueResultado): "INGRESO" | "EGRESO" {
  return bloque === "INGRESOS" ? "INGRESO" : "EGRESO";
}
