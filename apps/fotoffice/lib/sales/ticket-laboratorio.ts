/**
 * El «Pedido para laboratorio» dentro del ticket del Mostrador: un grupo de renglones (las copias
 * de una preparación) que se arma, se reemplaza y se quita entero, nunca de a uno. Módulo PURO.
 */
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

export type GrupoLab = { preparacionId: string; keys: string[] };

/**
 * Deshacer (Ctrl/⌘+Z) no puede dejar renglones del grupo sueltos: se sacan los de versiones
 * anteriores del grupo (o de un grupo ya quitado). Si el estado al que se vuelve no tiene el grupo
 * actual completo, el grupo sale del ticket pero la preparación se conserva (keys vacías): tocar
 * «Pedido para laboratorio» vuelve a ella con sus fotos, y si no se usa se anula al cobrar.
 */
export function deshacerConLab<R extends { key: string }>(
  anterior: readonly R[],
  laboratorio: GrupoLab | null,
  todasLab: ReadonlySet<string>,
): { rows: R[]; laboratorio: GrupoLab | null } {
  const grupo = new Set(laboratorio?.keys ?? []);
  const limpias = anterior.filter((r) => !todasLab.has(r.key) || grupo.has(r.key));
  const presentes = new Set(limpias.map((r) => r.key));
  const sinGrupo = laboratorio !== null && grupo.size > 0 && [...grupo].some((k) => !presentes.has(k));
  if (!sinGrupo) return { rows: limpias, laboratorio };
  return { rows: limpias.filter((r) => !grupo.has(r.key)), laboratorio: { preparacionId: laboratorio.preparacionId, keys: [] } };
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
