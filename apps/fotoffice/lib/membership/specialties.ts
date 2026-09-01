/**
 * Rubros fotográficos que un socio puede declarar.
 *
 * Vocabulario cerrado a propósito. Con texto libre, "social", "Social", "eventos" y
 * "fotografía social" serían cuatro rubros distintos y el listado por especialidad no
 * serviría para nada. "OTRO" existe para que nadie quede afuera, y lo que se explique
 * de más va en la presentación breve.
 */
/**
 * Los rubros van agrupados porque son muchos. Treinta fichas en una sola nube son imposibles de
 * recorrer: quien busca "New Born" la encuentra bajo Personas, no leyendo la lista entera.
 *
 * Los identificadores no se renombran nunca aunque cambie la etiqueta. `PRENSA` pasó a decir
 * "Fotoperiodismo" cuando se separó de Documentalismo, y quien ya lo tenía elegido lo conserva.
 */
export const GRUPOS_ESPECIALIDAD = [
  { id: "EVENTOS", label: "Eventos" },
  { id: "PERSONAS", label: "Personas" },
  { id: "COMERCIAL", label: "Comercial" },
  { id: "DOCUMENTAL", label: "Documental y autoral" },
  { id: "NATURALEZA", label: "Naturaleza" },
  { id: "TECNICA", label: "Técnica y oficio" },
] as const;

export type GrupoEspecialidadId = (typeof GRUPOS_ESPECIALIDAD)[number]["id"];

export const ESPECIALIDADES = [
  // ── Eventos ──
  { id: "SOCIAL", label: "Social y eventos", grupo: "EVENTOS" },
  { id: "CASAMIENTOS", label: "Casamientos", grupo: "EVENTOS" },
  { id: "XV", label: "Quince años (XV)", grupo: "EVENTOS" },
  { id: "BAUTISMOS", label: "Bautismos y comuniones", grupo: "EVENTOS" },
  { id: "EGRESADOS", label: "Egresados y graduaciones", grupo: "EVENTOS" },
  { id: "SHOWS", label: "Shows y recitales", grupo: "EVENTOS" },
  { id: "CORPORATIVOS", label: "Eventos corporativos", grupo: "EVENTOS" },
  { id: "DEPORTES", label: "Deportes", grupo: "EVENTOS" },

  // ── Personas ──
  { id: "RETRATO", label: "Retrato", grupo: "PERSONAS" },
  { id: "NEWBORN", label: "New Born", grupo: "PERSONAS" },
  { id: "EMBARAZO", label: "Embarazo y maternidad", grupo: "PERSONAS" },
  { id: "INFANTIL", label: "Infantil y familia", grupo: "PERSONAS" },
  { id: "ESCOLAR", label: "Escolar e institucional", grupo: "PERSONAS" },
  { id: "BOOKS", label: "Books y perfil profesional", grupo: "PERSONAS" },
  { id: "MODA", label: "Moda", grupo: "PERSONAS" },
  { id: "BOUDOIR", label: "Boudoir e íntima", grupo: "PERSONAS" },
  { id: "MASCOTAS", label: "Mascotas", grupo: "PERSONAS" },

  // ── Comercial ──
  { id: "PRODUCTO", label: "Producto y publicidad", grupo: "COMERCIAL" },
  { id: "GASTRONOMIA", label: "Gastronomía", grupo: "COMERCIAL" },
  { id: "INMOBILIARIA", label: "Inmobiliaria", grupo: "COMERCIAL" },
  { id: "ARQUITECTURA", label: "Arquitectura e interiores", grupo: "COMERCIAL" },
  { id: "INDUSTRIAL", label: "Industrial y corporativa", grupo: "COMERCIAL" },

  // ── Documental y autoral ──
  // `PRENSA` decía "Prensa y documental". Al separarse conserva su identificador: quien ya lo
  // había elegido sigue teniendo el rubro que quiso.
  { id: "PRENSA", label: "Fotoperiodismo", grupo: "DOCUMENTAL" },
  { id: "DOCUMENTALISMO", label: "Documentalismo", grupo: "DOCUMENTAL" },
  { id: "CALLEJERA", label: "Callejera", grupo: "DOCUMENTAL" },
  { id: "AUTORAL", label: "Autoral y bellas artes", grupo: "DOCUMENTAL" },

  // ── Naturaleza ──
  { id: "NATURALEZA", label: "Naturaleza y paisaje", grupo: "NATURALEZA" },
  { id: "FAUNA", label: "Fauna y vida silvestre", grupo: "NATURALEZA" },
  { id: "ASTRO", label: "Astrofotografía", grupo: "NATURALEZA" },
  { id: "SUBMARINA", label: "Submarina", grupo: "NATURALEZA" },

  // ── Técnica y oficio ──
  { id: "AEREA", label: "Aérea y drone", grupo: "TECNICA" },
  { id: "VIDEO", label: "Video y audiovisual", grupo: "TECNICA" },
  { id: "POSTPRODUCCION", label: "Retoque y postproducción", grupo: "TECNICA" },
  { id: "RESTAURACION", label: "Restauración y archivo", grupo: "TECNICA" },
  { id: "ANALOGICA", label: "Analógica y procesos alternativos", grupo: "TECNICA" },
  { id: "DOCENCIA", label: "Docencia y formación", grupo: "TECNICA" },
  { id: "OTRO", label: "Otro", grupo: "TECNICA" },
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

/** Los rubros de cada grupo, para dibujar la lista por secciones. */
export function especialidadesPorGrupo(): {
  id: GrupoEspecialidadId;
  label: string;
  items: { id: EspecialidadId; label: string }[];
}[] {
  return GRUPOS_ESPECIALIDAD.map((g) => ({
    id: g.id,
    label: g.label,
    items: ESPECIALIDADES.filter((e) => e.grupo === g.id).map((e) => ({
      id: e.id,
      label: e.label,
    })),
  }));
}
