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
  { id: "XV", label: "Quince años (XV)" },
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

/**
 * Cuántas puede elegir.
 *
 * El tope existe para que "especialidad" siga significando algo: quien marca todo no está
 * diciendo a qué se dedica. Diez es el número que pidió la institución — alcanza para un
 * fotógrafo que de verdad cubre varios rubros sin volver la lista inútil.
 */
export const MAX_ESPECIALIDADES = 10;

export type ResultadoEspecialidades =
  | { ok: true; valor: EspecialidadId[] }
  | { ok: false; error: string };

/**
 * Valida las especialidades declaradas.
 *
 * **El orden importa y es el de elección.** La primera que marcó es a lo que más se dedica, y
 * así hacia abajo: es lo que permite mostrar "Fotógrafa de casamientos" y no una lista de diez
 * rubros donde ninguno pesa más que otro. Por eso se conserva tal cual y no se ordena
 * alfabéticamente ni por el orden del catálogo.
 *
 * Descarta repetidas sin avisar: marcar dos veces lo mismo es un accidente de la interfaz, no
 * una intención que valga la pena discutirle a alguien que está completando un formulario.
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
