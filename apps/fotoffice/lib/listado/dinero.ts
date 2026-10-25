import { puedeEnContexto } from "@/lib/access/policy";
import type { ConDinero, ContextoListado, DefinicionListado } from "./tipos";

/**
 * La definición de una lista sin lo que depende de plata que esta persona no puede ver: columnas,
 * filtros y columnas exportadas marcadas con `dinero` (el módulo: Caja, Cuotas) se quitan si no
 * tiene `verDinero` sobre ese módulo. Es la misma regla que main aplica en sus pantallas (deuda y
 * pagos con Cuotas, movimientos con Caja). Se aplica en la página, en la exportación y en las
 * acciones en lote, así un filtro de plata tampoco se puede usar escribiéndolo en la dirección.
 */
export function recortarPorDinero<F>(def: DefinicionListado<F>, ctx: ContextoListado): DefinicionListado<F> {
  const permitido = (x: ConDinero) => !x.dinero || puedeEnContexto(ctx, "verDinero", x.dinero);
  return {
    ...def,
    columnas: def.columnas.filter(permitido),
    filtros: def.filtros.filter(permitido),
    exportar: { ...def.exportar, columnas: def.exportar.columnas.filter(permitido) },
  };
}
