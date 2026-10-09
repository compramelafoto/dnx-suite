import { hasLevel, type ModuleLevels } from "@/lib/permissions/levels";
import type { Instructivo } from "./tipos";

export const ORDEN_SECCIONES: readonly Instructivo["seccion"][] = [
  "Primeros pasos",
  "Socios",
  "Comunicación",
  "Comisión",
  "Dinero",
  "Actividades",
];

/** Las guías que tiene sentido mostrarle a alguien: las de los módulos que puede ver. */
export function instructivosVisibles(
  todos: readonly Instructivo[],
  levels: ModuleLevels,
  administra = false,
): Instructivo[] {
  return todos.filter(
    (g) =>
      (!g.soloAdministracion || administra) &&
      (!g.moduleKey || hasLevel(levels[g.moduleKey] ?? "NONE", "VIEW")),
  );
}

/** Agrupa por sección, en el orden fijo del índice; las secciones vacías no aparecen. */
export function agruparPorSeccion(
  guias: readonly Instructivo[],
): { seccion: Instructivo["seccion"]; guias: Instructivo[] }[] {
  return ORDEN_SECCIONES.map((seccion) => ({
    seccion,
    guias: guias.filter((g) => g.seccion === seccion),
  })).filter((g) => g.guias.length > 0);
}
