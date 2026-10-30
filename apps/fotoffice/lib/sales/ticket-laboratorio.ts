/**
 * El «Pedido para laboratorio» dentro del ticket del Mostrador: un grupo de renglones (las copias
 * de una preparación) que se arma, se reemplaza y se quita entero, nunca de a uno. Módulo PURO.
 */
import { leerProductosDeCopia } from "@/lib/impresiones/catalogo-copias";

/**
 * Pone los renglones nuevos del grupo en lugar de los viejos, en el lugar donde estaba el primero.
 * Si el ticket no tiene ninguno de los viejos (primera vez, o se vació), van al final.
 */
export function reemplazarGrupoLab<R extends { key: string }>(rows: readonly R[], keysViejas: readonly string[], nuevos: readonly R[]): R[] {
  const viejas = new Set(keysViejas);
  const lugar = rows.findIndex((r) => viejas.has(r.key));
  const sinViejas = rows.filter((r) => !viejas.has(r.key));
  if (lugar === -1) return [...sinViejas, ...nuevos];
  // Lo que había antes del primer renglón viejo no cambia de lugar.
  const antes = rows.slice(0, lugar).filter((r) => !viejas.has(r.key)).length;
  return [...sinViejas.slice(0, antes), ...nuevos, ...sinViejas.slice(antes)];
}

/**
 * Deshacer (Ctrl/⌘+Z) no puede dejar renglones del grupo sueltos: se sacan los de versiones
 * anteriores del grupo (o de un grupo ya quitado), y si el estado al que se vuelve no tiene el
 * grupo actual completo, `sinGrupo` avisa que hay que olvidar el pedido para laboratorio.
 */
export function deshacerConLab<R extends { key: string }>(
  anterior: readonly R[],
  keysGrupo: readonly string[] | null,
  todasLab: ReadonlySet<string>,
): { rows: R[]; sinGrupo: boolean } {
  const grupo = new Set(keysGrupo ?? []);
  const limpias = anterior.filter((r) => !todasLab.has(r.key) || grupo.has(r.key));
  const presentes = new Set(limpias.map((r) => r.key));
  const sinGrupo = grupo.size > 0 && [...grupo].some((k) => !presentes.has(k));
  return { rows: sinGrupo ? limpias.filter((r) => !grupo.has(r.key)) : limpias, sinGrupo };
}

/** Hay copias de laboratorio en el catálogo (los nombres que entiende `leerProductosDeCopia`). */
export function hayCopiasDeLaboratorio(
  productos: readonly { id: string; name: string; priceMinor: number; preferredProveedorId?: string | null }[],
): boolean {
  return (
    leerProductosDeCopia(
      productos.map((p) => ({ id: p.id, name: p.name, priceArs: p.priceMinor / 100, costArs: null, preferredProveedorId: p.preferredProveedorId ?? null })),
    ).length > 0
  );
}

/** «A», «A y B», «A, B y C». */
export function unirNombres(nombres: readonly string[]): string {
  if (nombres.length <= 1) return nombres[0] ?? "";
  return `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}`;
}

/** El aviso después de cobrar un ticket con pedido para laboratorio. */
export function avisoLaboratorios(nombres: readonly string[]): string {
  return `Las fotos se preparan y el pedido sale solo a ${unirNombres(nombres)} en unos minutos.`;
}
