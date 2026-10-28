import {
  CLASS_LIST_VARIABLE_KEY,
  classListCrowdWarning,
  countClassListStudents,
  formatClassListHeading,
  isClassListConfig,
  parseClassListGroups,
  readClassListOptions,
  serializeClassListGroups,
  type ClassListGroup,
  type ClassListOptions,
  type ClassListStudent,
} from "@repo/template-engine";

/**
 * Los cursos del bloque «Listado del curso» de un diseño: cuál es el propio, cuáles más se
 * pueden sumar y cómo queda el valor guardado al sumarlos o sacarlos.
 *
 * Puro (sin base): lo usan la revisión del fotógrafo, el canje de la familia (en el navegador,
 * para la vista previa, y en el servidor, para armar el diseño de verdad) y los tests.
 */

/** Un curso del colegio (o del Excel del álbum) que se puede sumar al listado. */
export type CursoDelAlbum = {
  /** Con qué se reconoce: lo que se guarda como `courseKey` en el listado. */
  key: string;
  /** Lo que se imprime arriba de sus alumnos («7° A»). */
  title: string;
  /** El turno («Mañana»), si el padrón lo trae. */
  shift?: string;
  students: ClassListStudent[];
};

/** Lo mismo sin los alumnos: lo que alcanza para mostrar las casillas. */
export type CursoParaElegir = { key: string; title: string; count: number };

export function cursoParaElegir(c: CursoDelAlbum): CursoParaElegir {
  // En las casillas el turno va siempre: dos cursos pueden llamarse igual en distinto turno.
  return { key: c.key, title: formatClassListHeading(c, true), count: c.students.length };
}

/** ¿La plantilla deja sumar otros cursos al listado? (opción del bloque, apagada por defecto). */
export function listadoPermiteSumarCursos(
  blocks: ReadonlyArray<{ type: string; configJson?: unknown }>,
): boolean {
  return blocks.some(
    (b) => b.type === "VARIABLE_TEXT" && isClassListConfig(b.configJson) && readClassListOptions(b.configJson).allowExtraCourses,
  );
}

/** Las opciones del primer bloque «Listado del curso» (orden, cómo se escribe cada nombre). */
export function opcionesDelListado(blocks: ReadonlyArray<{ type: string; configJson?: unknown }>): ClassListOptions {
  const b = blocks.find((x) => x.type === "VARIABLE_TEXT" && isClassListConfig(x.configJson));
  return readClassListOptions(b?.configJson);
}

/** ¿La plantilla tiene un bloque «Listado del curso»? */
export function plantillaTieneListado(blocks: ReadonlyArray<{ type: string; configJson?: unknown }>): boolean {
  return blocks.some((b) => b.type === "VARIABLE_TEXT" && isClassListConfig(b.configJson));
}

/** Los cursos del listado guardado en los textos del diseño (con el título del curso si es viejo). */
export function cursosDelListado(values: Record<string, string>): ClassListGroup[] {
  return parseClassListGroups(values[CLASS_LIST_VARIABLE_KEY], values["course.displayName"]);
}

function normalizar(t: string): string {
  return t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    // «3 B», «3° B» y «3º B» son el mismo curso (los títulos viejos no llevaban el ordinal).
    .replace(/[.°º]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * La clave del curso propio (el primero del listado). Los listados guardados antes no la
 * tienen: se reconoce por el título o, si no, por el curso que comparte más alumnos.
 */
export function claveDelCursoPropio(
  groups: readonly ClassListGroup[],
  disponibles: readonly CursoDelAlbum[],
): string | null {
  const propio = groups[0];
  if (!propio) return null;
  if (propio.courseKey) return propio.courseKey;
  const porTitulo = disponibles.find((c) => propio.title && normalizar(c.title) === normalizar(propio.title));
  if (porTitulo) return porTitulo.key;
  const nombres = new Set(propio.students.map((s) => normalizar(`${s.firstName} ${s.lastName}`)));
  let mejor: { key: string; comunes: number } | null = null;
  for (const c of disponibles) {
    const comunes = c.students.filter((s) => nombres.has(normalizar(`${s.firstName} ${s.lastName}`))).length;
    if (comunes > 0 && (!mejor || comunes > mejor.comunes)) mejor = { key: c.key, comunes };
  }
  return mejor && mejor.comunes * 2 >= propio.students.length ? mejor.key : null;
}

/** Las claves de los cursos que ya están en el listado, además del propio. */
export function clavesDeCursosSumados(
  groups: readonly ClassListGroup[],
  disponibles: readonly CursoDelAlbum[],
): string[] {
  const out: string[] = [];
  for (const g of groups.slice(1)) {
    const key =
      g.courseKey ?? disponibles.find((c) => g.title && normalizar(c.title) === normalizar(g.title))?.key ?? null;
    if (key && !out.includes(key)) out.push(key);
  }
  return out;
}

/**
 * El listado con el curso propio primero (tal cual estaba: con el alumno marcado) y después
 * los cursos elegidos, en el orden del colegio. Una clave que no es de un curso del álbum, o
 * que es la del propio, no suma nada.
 */
export function armarListadoConCursos(
  groups: readonly ClassListGroup[],
  disponibles: readonly CursoDelAlbum[],
  clavesElegidas: readonly string[],
): ClassListGroup[] {
  const propio = groups[0];
  if (!propio) return [];
  const clavePropia = claveDelCursoPropio(groups, disponibles);
  const elegidas = new Set(clavesElegidas);
  const extras = disponibles
    .filter((c) => elegidas.has(c.key) && c.key !== clavePropia)
    .map((c) => ({
      title: c.title,
      courseKey: c.key,
      ...(c.shift ? { shift: c.shift } : {}),
      students: c.students.map((s) => ({ firstName: s.firstName, lastName: s.lastName })),
    }));
  return [clavePropia && !propio.courseKey ? { ...propio, courseKey: clavePropia } : propio, ...extras];
}

/** Los textos del diseño con el listado armado con esos cursos. Sin listado, no cambia nada. */
export function valoresConCursos(
  values: Record<string, string>,
  disponibles: readonly CursoDelAlbum[],
  clavesElegidas: readonly string[],
): Record<string, string> {
  const groups = cursosDelListado(values);
  if (groups.length === 0) return values;
  return {
    ...values,
    [CLASS_LIST_VARIABLE_KEY]: serializeClassListGroups(armarListadoConCursos(groups, disponibles, clavesElegidas)),
  };
}

/** Los cursos que se ofrecen para sumar: todos los del álbum menos el propio. */
export function cursosParaSumar(
  groups: readonly ClassListGroup[],
  disponibles: readonly CursoDelAlbum[],
): CursoDelAlbum[] {
  const clavePropia = claveDelCursoPropio(groups, disponibles);
  return disponibles.filter((c) => c.key !== clavePropia);
}

export type AvisoDeMuchaGente = { caras: number; alumnos: number };

/**
 * Si la foto grupal muestra un 30 % más de caras que alumnos tiene el listado, se avisa: lo más
 * probable es que la foto tenga más de un curso.
 */
export function avisoDeMuchaGente(
  caras: number | null | undefined,
  groups: readonly ClassListGroup[],
): AvisoDeMuchaGente | null {
  const alumnos = countClassListStudents(groups);
  return classListCrowdWarning(caras, alumnos) ? { caras: caras as number, alumnos } : null;
}

/** La foto puesta en el hueco de la foto grupal del diseño, si hay. */
export function fotoGrupalDelDiseno(
  slots: ReadonlyArray<{ blockId: string; role: string | null }>,
  asignadas: Record<string, { photoId: number | null } | undefined>,
): number | null {
  for (const s of slots) {
    if (s.role !== "group") continue;
    const id = asignadas[s.blockId]?.photoId;
    if (typeof id === "number") return id;
  }
  return null;
}
