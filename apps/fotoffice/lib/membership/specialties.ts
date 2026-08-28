/**
 * Rubros fotográficos que un socio puede declarar.
 *
 * Vocabulario cerrado a propósito. Con texto libre, "social", "Social", "eventos" y
 * "fotografía social" serían cuatro rubros distintos y el listado por especialidad no
 * serviría para nada. "OTRO" existe para que nadie quede afuera, y lo que se explique
 * de más va en la presentación breve.
 */
export const ESPECIALIDADES = [
  { id: "SOCIAL", label: "Social y eventos" },
  { id: "CASAMIENTOS", label: "Casamientos" },
  { id: "RETRATO", label: "Retrato" },
  { id: "INFANTIL", label: "Infantil y familia" },
  { id: "ESCOLAR", label: "Escolar e institucional" },
  { id: "PRODUCTO", label: "Producto y publicidad" },
  { id: "MODA", label: "Moda" },
  { id: "ARQUITECTURA", label: "Arquitectura e interiores" },
  { id: "DEPORTES", label: "Deportes" },
  { id: "PRENSA", label: "Prensa y documental" },
  { id: "NATURALEZA", label: "Naturaleza y paisaje" },
  { id: "AEREA", label: "Aérea y drone" },
  { id: "VIDEO", label: "Video y audiovisual" },
  { id: "RESTAURACION", label: "Restauración y archivo" },
  { id: "DOCENCIA", label: "Docencia y formación" },
  { id: "OTRO", label: "Otro" },
] as const;

export type EspecialidadId = (typeof ESPECIALIDADES)[number]["id"];

const VALIDAS = new Set<string>(ESPECIALIDADES.map((e) => e.id));

/** Cuántas puede elegir. Sin tope, "especialidad" deja de significar algo. */
export const MAX_ESPECIALIDADES = 5;

export type ResultadoEspecialidades =
  | { ok: true; valor: EspecialidadId[] }
  | { ok: false; error: string };

/**
 * Valida las especialidades declaradas. Descarta repetidas y conserva el orden de elección.
 */
export function parsearEspecialidades(
  entrada: readonly string[] | null | undefined
): ResultadoEspecialidades {
  if (!entrada || entrada.length === 0) return { ok: true, valor: [] };

  const vistas = new Set<string>();
  const salida: EspecialidadId[] = [];
  for (const bruto of entrada) {
    const id = String(bruto).trim().toUpperCase();
    if (!id) continue;
    if (!VALIDAS.has(id)) {
      return { ok: false, error: "Elegiste un rubro que no existe en la lista." };
    }
    if (vistas.has(id)) continue;
    vistas.add(id);
    salida.push(id as EspecialidadId);
  }
  if (salida.length > MAX_ESPECIALIDADES) {
    return {
      ok: false,
      error: `Elegí hasta ${MAX_ESPECIALIDADES} rubros.`,
    };
  }
  return { ok: true, valor: salida };
}

export function etiquetaEspecialidad(id: string): string {
  return ESPECIALIDADES.find((e) => e.id === id)?.label ?? id;
}
