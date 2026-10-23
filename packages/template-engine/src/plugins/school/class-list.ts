/**
 * Listado del curso: todos los alumnos del curso al que pertenece el diseño, con el dueño del
 * diseño destacado si se quiere.
 *
 * Es un bloque de dato variable (`VARIABLE_TEXT`) con la clave `course.studentList`. No es un
 * tipo de bloque nuevo a propósito: un tipo nuevo exige migrar el enum en todas las bases, y el
 * bloque de dato variable ya trae todo lo tipográfico (familia, cuerpo, color, alineación).
 *
 * Las variables de las plantillas son textos, así que la lista viaja como JSON dentro de un
 * texto (`serializeClassList`). Quien dibuja —el lienzo del editor, la vista previa y la
 * impresión— la lee con `parseClassListValue` y la reparte con `layoutClassList`, la misma
 * cuenta en los tres lados para que lo que se ve al diseñar sea lo que sale impreso.
 */

export const CLASS_LIST_VARIABLE_KEY = "course.studentList";

export type ClassListStudent = {
  firstName: string;
  lastName: string;
  /** El alumno dueño de este diseño. */
  isOwner?: boolean;
};

export type ClassListOptions = {
  /** Por qué se ordena la lista. */
  sortBy: "firstName" | "lastName";
  /** Cómo se escribe cada alumno: "Daniel Pérez" o "Pérez, Daniel". */
  nameOrder: "firstLast" | "lastFirst";
  /** Todos los nombres ("María Sol") o sólo el primero ("María"). */
  givenNames: "all" | "first";
  /** El dueño del diseño en negrita. */
  highlightOwner: boolean;
  /** En cuántas columnas se reparte; se llena de arriba hacia abajo. */
  columns: number;
  /**
   * El título de cada curso («7.° A») arriba de sus alumnos. Va siempre, aunque el listado
   * tenga un solo curso: así la plantilla no necesita un texto aparte con el curso.
   */
  showHeading: boolean;
  /** Cuánto más grande que los nombres sale el título del curso (1 = igual). */
  headingScale: number;
  /**
   * Si el fotógrafo (y la familia, al revisar) pueden sumar otros cursos del mismo colegio al
   * listado: una foto grupal con 7.° A y 7.° B. Apagado, el listado lleva sólo el curso propio.
   */
  allowExtraCourses: boolean;
};

export const CLASS_LIST_MAX_COLUMNS = 4;

export const DEFAULT_CLASS_LIST_OPTIONS: ClassListOptions = {
  sortBy: "lastName",
  nameOrder: "firstLast",
  givenNames: "all",
  highlightOwner: true,
  columns: 2,
  showHeading: true,
  headingScale: 1.2,
  allowExtraCourses: false,
};

export const CLASS_LIST_HEADING_SCALE_MIN = 0.8;
export const CLASS_LIST_HEADING_SCALE_MAX = 2;

export function isClassListConfig(config: unknown): boolean {
  if (!config || typeof config !== "object" || Array.isArray(config)) return false;
  return (config as Record<string, unknown>).variableKey === CLASS_LIST_VARIABLE_KEY;
}

/** Las opciones guardadas en `configJson.classList`, con los valores por defecto donde falten. */
export function readClassListOptions(config: unknown): ClassListOptions {
  const cfg =
    config && typeof config === "object" && !Array.isArray(config) ? (config as Record<string, unknown>) : {};
  const raw =
    cfg.classList && typeof cfg.classList === "object" && !Array.isArray(cfg.classList)
      ? (cfg.classList as Record<string, unknown>)
      : {};
  const d = DEFAULT_CLASS_LIST_OPTIONS;
  const columns = typeof raw.columns === "number" && Number.isFinite(raw.columns) ? Math.round(raw.columns) : d.columns;
  return {
    sortBy: raw.sortBy === "firstName" || raw.sortBy === "lastName" ? raw.sortBy : d.sortBy,
    nameOrder: raw.nameOrder === "firstLast" || raw.nameOrder === "lastFirst" ? raw.nameOrder : d.nameOrder,
    givenNames: raw.givenNames === "all" || raw.givenNames === "first" ? raw.givenNames : d.givenNames,
    highlightOwner: typeof raw.highlightOwner === "boolean" ? raw.highlightOwner : d.highlightOwner,
    columns: Math.min(CLASS_LIST_MAX_COLUMNS, Math.max(1, columns)),
    showHeading: typeof raw.showHeading === "boolean" ? raw.showHeading : d.showHeading,
    headingScale:
      typeof raw.headingScale === "number" && Number.isFinite(raw.headingScale)
        ? Math.min(CLASS_LIST_HEADING_SCALE_MAX, Math.max(CLASS_LIST_HEADING_SCALE_MIN, raw.headingScale))
        : d.headingScale,
    allowExtraCourses: typeof raw.allowExtraCourses === "boolean" ? raw.allowExtraCourses : d.allowExtraCourses,
  };
}

/** Un curso del listado: su título («7.° A») y sus alumnos. */
export type ClassListGroup = {
  /** Lo que se imprime arriba de los alumnos. Vacío: el curso va sin título. */
  title: string;
  /**
   * Con qué se reconoce el curso en el padrón del álbum (para sumarlo o sacarlo). No se
   * imprime. Falta en los listados guardados antes de que hubiera varios cursos.
   */
  courseKey?: string;
  students: ClassListStudent[];
};

function studentToWire(s: ClassListStudent) {
  return s.isOwner ? { f: s.firstName, l: s.lastName, o: 1 } : { f: s.firstName, l: s.lastName };
}

export function serializeClassList(students: readonly ClassListStudent[]): string {
  return JSON.stringify(students.map(studentToWire));
}

/**
 * Uno o más cursos, cada uno con su título, como texto de la variable:
 * `{"g":[{"t":"7.° A","k":"…","s":[{"f":"Ana","l":"Pérez"}]}]}`.
 *
 * Los listados guardados antes (un arreglo plano de alumnos) se siguen leyendo: valen como un
 * solo curso, con el título que se le pase a `parseClassListGroups`.
 */
export function serializeClassListGroups(groups: readonly ClassListGroup[]): string {
  return JSON.stringify({
    g: groups.map((g) => ({
      t: g.title,
      ...(g.courseKey ? { k: g.courseKey } : {}),
      s: g.students.map(studentToWire),
    })),
  });
}

function readStudents(parsed: unknown): ClassListStudent[] {
  if (!Array.isArray(parsed)) return [];
  const out: ClassListStudent[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const firstName = typeof r.f === "string" ? r.f.trim() : "";
    const lastName = typeof r.l === "string" ? r.l.trim() : "";
    if (!firstName && !lastName) continue;
    out.push(r.o ? { firstName, lastName, isOwner: true } : { firstName, lastName });
  }
  return out;
}

function parseJson(raw: unknown): unknown {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  if (!t.startsWith("[") && !t.startsWith("{")) return null;
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

/**
 * Los cursos del listado desde el texto de la variable. Un listado viejo (arreglo plano) es un
 * curso con `fallbackTitle` (el «course.displayName» del diseño). Algo que no se entiende no
 * tiene cursos. Los cursos sin alumnos se descartan.
 */
export function parseClassListGroups(raw: unknown, fallbackTitle?: string | null): ClassListGroup[] {
  const parsed = parseJson(raw);
  if (Array.isArray(parsed)) {
    const students = readStudents(parsed);
    return students.length ? [{ title: (fallbackTitle ?? "").trim(), students }] : [];
  }
  if (!parsed || typeof parsed !== "object" || !Array.isArray((parsed as Record<string, unknown>).g)) return [];
  const out: ClassListGroup[] = [];
  for (const item of (parsed as { g: unknown[] }).g) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const students = readStudents(r.s);
    if (students.length === 0) continue;
    const title = typeof r.t === "string" ? r.t.trim() : "";
    const courseKey = typeof r.k === "string" && r.k ? r.k : undefined;
    out.push(courseKey ? { title, courseKey, students } : { title, students });
  }
  return out;
}

/** Todos los alumnos del listado, de todos los cursos, en un solo arreglo. */
export function parseClassListValue(raw: unknown): ClassListStudent[] {
  return parseClassListGroups(raw).flatMap((g) => g.students);
}

const collator = new Intl.Collator("es", { sensitivity: "base", numeric: true });

export type ClassListLine = { text: string; bold: boolean };

/** Ordena y escribe cada alumno según las opciones. */
export function formatClassList(
  students: readonly ClassListStudent[],
  options: ClassListOptions,
): ClassListLine[] {
  const sorted = [...students].sort((a, b) => {
    const [a1, a2, b1, b2] =
      options.sortBy === "firstName"
        ? [a.firstName, a.lastName, b.firstName, b.lastName]
        : [a.lastName, a.firstName, b.lastName, b.firstName];
    return collator.compare(a1, b1) || collator.compare(a2, b2);
  });
  return sorted.map((s) => {
    const given = options.givenNames === "first" ? (s.firstName.split(/\s+/)[0] ?? "") : s.firstName;
    const text =
      options.nameOrder === "lastFirst"
        ? [s.lastName, given].filter(Boolean).join(", ")
        : [given, s.lastName].filter(Boolean).join(" ");
    return { text, bold: options.highlightOwner && s.isOwner === true };
  });
}

export type ClassListCell = ClassListLine & {
  /** Relativo a la esquina del bloque, en las mismas unidades que `width`/`height`. */
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ClassListLayout = {
  cells: ClassListCell[];
  /** El cuerpo con que se dibuja: el elegido, o menos si la lista no entra en el alto. */
  fontSize: number;
};

/**
 * Reparte la lista en columnas, de arriba hacia abajo. Si no entra en el alto del bloque, achica
 * el cuerpo de todos por igual: un nombre más chico que el resto se notaría.
 *
 * `verticalAlign` ubica el bloque de filas en el alto de la caja: arriba (lo de siempre), centrado
 * o abajo. Las columnas se mueven juntas, como un solo párrafo; el hueco se mide con la columna
 * más larga, que es la que ocupa más alto.
 */
export function layoutClassList(input: {
  lines: readonly ClassListLine[];
  width: number;
  height: number;
  fontSize: number;
  lineHeight: number;
  columns: number;
  verticalAlign?: "top" | "middle" | "bottom";
}): ClassListLayout {
  const { lines } = input;
  const lineHeight = input.lineHeight > 0 ? input.lineHeight : 1.2;
  if (lines.length === 0) return { cells: [], fontSize: input.fontSize };
  const columns = Math.max(1, Math.min(input.columns, lines.length));
  const rows = Math.ceil(lines.length / columns);
  const rowHeight = Math.min(input.fontSize * lineHeight, input.height / rows);
  const fontSize = rowHeight / lineHeight;
  const gap = columns > 1 ? fontSize * 0.8 : 0;
  const cellWidth = Math.max(1, (input.width - gap * (columns - 1)) / columns);
  const hueco = Math.max(0, input.height - rows * rowHeight);
  const top =
    input.verticalAlign === "middle" ? hueco / 2 : input.verticalAlign === "bottom" ? hueco : 0;
  const cells = lines.map((line, i) => {
    const col = Math.floor(i / rows);
    const row = i % rows;
    return { ...line, x: col * (cellWidth + gap), y: top + row * rowHeight, width: cellWidth, height: rowHeight };
  });
  return { cells, fontSize };
}

export type ClassListSection = {
  /** El título del curso; null si va sin título. */
  heading: string | null;
  lines: ClassListLine[];
};

/** Ordena y escribe cada curso; el título sólo si las opciones lo piden y el curso lo tiene. */
export function formatClassListGroups(
  groups: readonly ClassListGroup[],
  options: ClassListOptions,
): ClassListSection[] {
  return groups
    .map((g) => ({
      heading: options.showHeading && g.title.trim() ? g.title.trim() : null,
      lines: formatClassList(g.students, options),
    }))
    .filter((s) => s.lines.length > 0);
}

export type ClassListSectionCell = ClassListCell & {
  /** El cuerpo de esta celda: el título del curso sale más grande que los nombres. */
  fontSize: number;
  /** Es el título del curso (va en negrita y ocupa todo el ancho). */
  heading: boolean;
};

export type ClassListSectionsLayout = {
  cells: ClassListSectionCell[];
  /** El cuerpo de los nombres (el elegido, o menos si no entra). */
  fontSize: number;
};

/**
 * Como `layoutClassList`, pero con uno o más cursos: cada uno con su título a todo el ancho y
 * sus alumnos en columnas debajo, y medio renglón de aire entre un curso y el siguiente. Si no
 * entra todo en el alto, se achica todo por igual (títulos y nombres).
 *
 * Un solo curso sin título da exactamente lo mismo que `layoutClassList`.
 */
export function layoutClassListSections(input: {
  sections: readonly ClassListSection[];
  width: number;
  height: number;
  fontSize: number;
  lineHeight: number;
  columns: number;
  verticalAlign?: "top" | "middle" | "bottom";
  /** Cuánto más grande que los nombres va el título (por defecto el de las opciones). */
  headingScale?: number;
}): ClassListSectionsLayout {
  const lineHeight = input.lineHeight > 0 ? input.lineHeight : 1.2;
  const headingScale = input.headingScale ?? DEFAULT_CLASS_LIST_OPTIONS.headingScale;
  const sections = input.sections.filter((s) => s.lines.length > 0);
  if (sections.length === 0) return { cells: [], fontSize: input.fontSize };
  const SECTION_GAP = 0.5;
  const plan = sections.map((s) => {
    const columns = Math.max(1, Math.min(input.columns, s.lines.length));
    return { ...s, columns, rows: Math.ceil(s.lines.length / columns) };
  });
  // Alto total en «renglones de nombre»: así el achique es una sola cuenta lineal.
  const units =
    plan.reduce((acc, s) => acc + s.rows + (s.heading ? headingScale : 0), 0) + SECTION_GAP * (plan.length - 1);
  const rowHeight = Math.min(input.fontSize * lineHeight, input.height / units);
  const fontSize = rowHeight / lineHeight;
  const total = rowHeight * units;
  const hueco = Math.max(0, input.height - total);
  let y = input.verticalAlign === "middle" ? hueco / 2 : input.verticalAlign === "bottom" ? hueco : 0;
  const cells: ClassListSectionCell[] = [];
  plan.forEach((s, si) => {
    if (si > 0) y += rowHeight * SECTION_GAP;
    if (s.heading) {
      const h = rowHeight * headingScale;
      cells.push({ text: s.heading, bold: true, heading: true, x: 0, y, width: input.width, height: h, fontSize: fontSize * headingScale });
      y += h;
    }
    const gap = s.columns > 1 ? fontSize * 0.8 : 0;
    const cellWidth = Math.max(1, (input.width - gap * (s.columns - 1)) / s.columns);
    s.lines.forEach((line, i) => {
      const col = Math.floor(i / s.rows);
      const row = i % s.rows;
      cells.push({
        ...line,
        heading: false,
        fontSize,
        x: col * (cellWidth + gap),
        y: y + row * rowHeight,
        width: cellWidth,
        height: rowHeight,
      });
    });
    y += s.rows * rowHeight;
  });
  return { cells, fontSize };
}

/**
 * Lo que dibujan el lienzo, la vista previa y la impresión para un bloque «Listado del curso»:
 * los cursos ya ordenados, escritos y repartidos según las opciones del bloque.
 */
export function layoutClassListBlock(input: {
  groups: readonly ClassListGroup[];
  options: ClassListOptions;
  width: number;
  height: number;
  fontSize: number;
  lineHeight: number;
  verticalAlign?: "top" | "middle" | "bottom";
}): ClassListSectionsLayout {
  return layoutClassListSections({
    sections: formatClassListGroups(input.groups, input.options),
    width: input.width,
    height: input.height,
    fontSize: input.fontSize,
    lineHeight: input.lineHeight,
    columns: input.options.columns,
    verticalAlign: input.verticalAlign,
    headingScale: input.options.headingScale,
  });
}

/** Total de alumnos de todos los cursos del listado. */
export function countClassListStudents(groups: readonly ClassListGroup[]): number {
  return groups.reduce((acc, g) => acc + g.students.length, 0);
}

/**
 * ¿La foto grupal muestra bastante más gente que el listado? Con un 30 % más de caras que
 * alumnos, lo más probable es que en la foto haya más de un curso (7.° A y 7.° B juntos).
 * Sin caras contadas (la foto no se analizó) o sin alumnos no se avisa.
 */
export const CLASS_LIST_CROWD_RATIO = 1.3;

export function classListCrowdWarning(faces: number | null | undefined, students: number): boolean {
  if (faces == null || !Number.isFinite(faces) || faces <= 0 || students <= 0) return false;
  return faces >= students * CLASS_LIST_CROWD_RATIO;
}

export function classListCrowdMessage(faces: number, students: number): string {
  return `En esta foto se ven unas ${faces} personas y el listado tiene ${students}. ¿Hay más de un curso?`;
}

/** El título del curso de muestra (coincide con el curso de muestra del catálogo). */
export const CLASS_LIST_SAMPLE_TITLE = "3.º B";

/** Un curso de muestra para diseñar. La dueña coincide con el alumno de muestra del catálogo. */
export const CLASS_LIST_SAMPLE: ClassListStudent[] = [
  { firstName: "Tomás", lastName: "Acosta" },
  { firstName: "Valentina", lastName: "Benítez" },
  { firstName: "Mateo Joaquín", lastName: "Castro" },
  { firstName: "Martina", lastName: "Díaz" },
  { firstName: "Benjamín", lastName: "Fernández" },
  { firstName: "Catalina", lastName: "Giménez" },
  { firstName: "María", lastName: "Gómez", isOwner: true },
  { firstName: "Santiago", lastName: "Herrera" },
  { firstName: "Emma Sofía", lastName: "López" },
  { firstName: "Thiago", lastName: "Martínez" },
  { firstName: "Isabella", lastName: "Morales" },
  { firstName: "Lautaro", lastName: "Pérez" },
  { firstName: "Olivia", lastName: "Quiroga" },
  { firstName: "Felipe", lastName: "Romero" },
  { firstName: "Mía", lastName: "Sosa" },
  { firstName: "Joaquín", lastName: "Torres" },
  { firstName: "Renata", lastName: "Vega" },
  { firstName: "Bautista", lastName: "Zapata" },
];

/** El listado de muestra del editor: un curso con su título. */
export const CLASS_LIST_SAMPLE_GROUPS: ClassListGroup[] = [{ title: CLASS_LIST_SAMPLE_TITLE, students: CLASS_LIST_SAMPLE }];
