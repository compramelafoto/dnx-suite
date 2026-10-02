import { ordenDeFamilias } from "./suggested";
import { getModuleDefinition } from "./registry";

/**
 * Ordena las secciones del menú según la familia de su módulo para el tipo de organización.
 *
 * Las secciones sin módulo (Inicio, Institución, Plataforma…) no se mueven: conservan su
 * posición. Solo se reacomodan entre sí los lugares que ocupan las secciones con módulo.
 * Sin tipo, el orden es el original.
 */
export function ordenarSecciones<T extends { moduleKey: string | null }>(
  secciones: T[],
  tipo: string | null,
): T[] {
  if (!tipo) return [...secciones];
  const orden = ordenDeFamilias(tipo);
  const peso = (s: T): number => {
    const familia = s.moduleKey ? getModuleDefinition(s.moduleKey)?.family : undefined;
    const i = familia ? orden.indexOf(familia) : -1;
    return i === -1 ? orden.length : i;
  };
  const conModulo = secciones
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => s.moduleKey !== null)
    .sort((a, b) => peso(a.s) - peso(b.s) || a.i - b.i)
    .map(({ s }) => s);
  let k = 0;
  return secciones.map((s) => (s.moduleKey === null ? s : conModulo[k++]));
}
