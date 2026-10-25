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
  /**
   * El turno al lado del título del curso («3.° B · Turno mañana»). Prendido por defecto: si el
   * curso no trae turno, no se imprime nada. Apagado, igual se muestra cuando dos cursos del
   * listado se llaman igual y sólo el turno los distingue.
   */
  showShift: boolean;
  /** El nombre del colegio una sola vez, arriba de todo, dentro de la misma caja del listado. */
  showSchoolName: boolean;
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
  showShift: true,
  showSchoolName: false,
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
    showShift: typeof raw.showShift === "boolean" ? raw.showShift : d.showShift,
    showSchoolName: typeof raw.showSchoolName === "boolean" ? raw.showSchoolName : d.showSchoolName,
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
  /** El turno del curso («Mañana»), si se sabe. Se imprime según la opción «Mostrar turno». */
  shift?: string;
  students: ClassListStudent[];
};

/**
 * El nombre del curso escrito con naturalidad, para el título del listado y el «Curso» del
 * diseño. Arregla sólo lo que salía mal, sin tocar lo que el fotógrafo escribió a propósito:
 *
 * - un número suelto al principio es un ordinal: «3 B» → «3.° B», «3» → «3.°»;
 * - la coma pegada al ordinal sobra: «3°, B» → «3° B»;
 * - el agregado entre paréntesis de los listados viejos («1 B (Tarde, Primario)») pasa a ir
 *   con puntos medios: «1.° B · Tarde · Primario».
 *
 * «7° Grado A», «3.º B» o «Sala de 5» quedan como están.
 */
export function formatCourseName(raw: string | null | undefined): string {
  let t = (raw ?? "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  let extra: string[] = [];
  const paren = /\s*\(([^()]*)\)\s*$/.exec(t);
  if (paren && paren.index > 0) {
    extra = paren[1]!.split(",").map((x) => x.trim()).filter(Boolean);
    t = t.slice(0, paren.index).trim();
  }
  t = t.replace(/^(\d+\s*\.?\s*[°º]?)\s*,\s*/, "$1 ");
  t = t.replace(/^(\d+)(?=\s|$)(?!\s*[°º.])/, "$1.°");
  return [t, ...extra].filter(Boolean).join(" · ");
}

/** «Mañana» → «Turno mañana». Si ya dice «turno», sólo se ordenan las mayúsculas. */
export function formatShiftLabel(raw: string | null | undefined): string {
  const t = (raw ?? "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  const lower = t.toLocaleLowerCase("es");
  const conTurno = lower.startsWith("turno") ? lower : `turno ${lower}`;
  return conTurno.charAt(0).toLocaleUpperCase("es") + conTurno.slice(1);
}

/** El título impreso de un curso: «3.° B» o, con el turno, «3.° B · Turno mañana». */
export function formatClassListHeading(group: Pick<ClassListGroup, "title" | "shift">, showShift: boolean): string {
  const curso = formatCourseName(group.title);
  const turno = showShift ? formatShiftLabel(group.shift) : "";
  return [curso, turno].filter(Boolean).join(" · ");
}

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
      ...(g.shift?.trim() ? { h: g.shift.trim() } : {}),
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
    const shift = typeof r.h === "string" && r.h.trim() ? r.h.trim() : undefined;
    out.push({ title, ...(courseKey ? { courseKey } : {}), ...(shift ? { shift } : {}), students });
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

function courseNameKey(title: string): string {
  return formatCourseName(title).toLocaleLowerCase("es");
}

/** «A», «A y B», «A, B y C». */
function joinSpanish(parts: readonly string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} y ${parts[parts.length - 1]}`;
}

/**
 * Un solo título para varios cursos: «7.° A y 7.° B · Turno mañana». Si los turnos no
 * coinciden, cada curso lleva el suyo: «7.° A · Turno mañana y 7.° B · Turno tarde».
 */
export function combineClassListHeadings(headings: readonly string[]): string {
  const partes = headings.filter((h) => h.trim() !== "");
  if (partes.length <= 1) return partes[0] ?? "";
  const cortes = partes.map((h) => {
    const i = h.indexOf(" · ");
    return i > 0 ? { curso: h.slice(0, i), resto: h.slice(i + 3) } : { curso: h, resto: "" };
  });
  const resto = cortes[0]!.resto;
  if (cortes.every((c) => c.resto === resto)) {
    const cursos = joinSpanish(cortes.map((c) => c.curso));
    return resto ? `${cursos} · ${resto}` : cursos;
  }
  return joinSpanish(partes);
}

/**
 * Ordena y escribe el listado; el título sólo si las opciones lo piden y el curso lo tiene.
 * El turno va según «Mostrar turno», salvo que dos cursos del listado se llamen igual: ahí el
 * turno es lo único que los distingue y va siempre.
 *
 * Con varios cursos (una foto grupal de 7.° A y 7.° B juntos) sale un solo título con todos los
 * cursos y los alumnos de todos mezclados, en el orden de las opciones.
 */
export function formatClassListGroups(
  groups: readonly ClassListGroup[],
  options: ClassListOptions,
): ClassListSection[] {
  const conAlumnos = groups.filter((g) => g.students.length > 0);
  const nombres = conAlumnos.map((g) => courseNameKey(g.title));
  const titulo = (g: ClassListGroup) => {
    const nombre = courseNameKey(g.title);
    const repetido = nombre !== "" && nombres.filter((n) => n === nombre).length > 1;
    return options.showHeading ? formatClassListHeading(g, options.showShift || repetido) : "";
  };
  if (conAlumnos.length > 1) {
    const heading = options.showHeading ? combineClassListHeadings(conAlumnos.map(titulo)) : "";
    const lines = formatClassList(
      conAlumnos.flatMap((g) => g.students),
      options,
    );
    return lines.length > 0 ? [{ heading: heading || null, lines }] : [];
  }
  return conAlumnos
    .map((g) => {
      const heading = titulo(g);
      return { heading: heading || null, lines: formatClassList(g.students, options) };
    })
    .filter((s) => s.lines.length > 0);
}

export type ClassListSectionCell = ClassListCell & {
  /** El cuerpo de esta celda: el título del curso sale más grande que los nombres. */
  fontSize: number;
  /** Es un título: el del curso o el nombre del colegio (va en negrita). */
  heading: boolean;
  /** Es la línea del colegio, arriba de todo. */
  school?: boolean;
};

export type ClassListSectionsLayout = {
  cells: ClassListSectionCell[];
  /** El cuerpo de los nombres (el elegido, o menos si no entra). */
  fontSize: number;
  /** En cuántas columnas se repartieron los nombres. */
  columns: number;
};

/** Aire entre un curso y el siguiente, en renglones de nombre. */
const SECTION_GAP = 0.5;
/** Aire debajo de la línea del colegio, en renglones de nombre. */
const SCHOOL_GAP = 0.4;
/**
 * Aire arriba y abajo del título de un curso, en renglones de nombre. Es el mismo de los dos
 * lados, así el título queda centrado entre el borde del recuadro y la primera fila de nombres.
 */
const HEADING_GAP = 0.6;
/**
 * Ancho medio de una letra en negrita, en cuerpos. Sirve para achicar un título que no entra en
 * su columna. Es una estimación (acá no hay medidas de la tipografía), pero es la misma cuenta
 * en el lienzo, la vista previa y la impresión, así que sale igual en los tres.
 */
const AVG_CHAR_EM = 0.6;
/** Con dos cursos o más, los nombres se reparten siempre en estas columnas. */
export const CLASS_LIST_MULTI_COURSE_COLUMNS = 4;
/** Un título de curso no queda solo al pie de una columna: va con al menos estos nombres. */
const KEEP_WITH_HEADING = 2;
/** Ancho medio de una letra normal, en cuerpos (los nombres). Misma estimación que arriba. */
const AVG_NAME_CHAR_EM = 0.52;

function fitFont(text: string, width: number, size: number): number {
  const chars = [...text].length;
  if (chars === 0 || width <= 0) return size;
  return Math.min(size, width / (chars * AVG_CHAR_EM));
}

type FlowItem =
  | { kind: "heading"; text: string; sub: string | null; units: number; gapBefore: number; keep: number }
  | { kind: "name"; line: ClassListLine; units: number; gapBefore: number };

type FlowPlacement = { item: FlowItem; col: number; y: number };

/** Llena las columnas de arriba hacia abajo con un alto máximo `limit`; null si no entra. */
function flowInto(
  items: readonly FlowItem[],
  columns: number,
  limit: number,
): { placed: FlowPlacement[]; used: number } | null {
  const EPS = 1e-9;
  const placed: FlowPlacement[] = [];
  let col = 0;
  let used = 0;
  let maxUsed = 0;
  for (const item of items) {
    let gap = used > 0 ? item.gapBefore : 0;
    const need = gap + item.units + (item.kind === "heading" ? item.keep : 0);
    if (used > 0 && used + need > limit + EPS) {
      col += 1;
      used = 0;
      gap = 0;
    }
    if (col >= columns) return null;
    placed.push({ item, col, y: used + gap });
    used += gap + item.units;
    maxUsed = Math.max(maxUsed, used);
  }
  return { placed, used: maxUsed };
}

/**
 * Como `layoutClassList`, pero con uno o más cursos, cada uno con su título, y la línea del
 * colegio arriba de todo si se pide.
 *
 * - Un curso: su título a todo el ancho y los alumnos debajo, en las columnas del bloque.
 * - Dos cursos o más: los nombres van siempre en 4 columnas, para que entren. Los cursos
 *   corren seguidos de arriba hacia abajo y de una columna a la siguiente; cada título va al
 *   principio de su curso, en el ancho de su columna, y nunca queda solo al pie: si no entra
 *   con sus primeros nombres, pasa a la columna siguiente.
 *
 * Si no entra todo en el alto, se achica todo por igual (colegio, títulos y nombres). Un solo
 * curso sin título ni colegio da exactamente lo mismo que `layoutClassList`.
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
  /** El colegio, una vez arriba de todo. Vacío o null: no va. */
  schoolName?: string | null;
}): ClassListSectionsLayout {
  const lineHeight = input.lineHeight > 0 ? input.lineHeight : 1.2;
  const headingScale = input.headingScale ?? DEFAULT_CLASS_LIST_OPTIONS.headingScale;
  const sections = input.sections.filter((s) => s.lines.length > 0);
  if (sections.length === 0) return { cells: [], fontSize: input.fontSize, columns: 0 };
  const school = (input.schoolName ?? "").replace(/\s+/g, " ").trim();
  const schoolUnits = school ? headingScale + SCHOOL_GAP : 0;
  const cells: ClassListSectionCell[] = [];

  const alignTop = (total: number) => {
    const hueco = Math.max(0, input.height - total);
    return input.verticalAlign === "middle" ? hueco / 2 : input.verticalAlign === "bottom" ? hueco : 0;
  };
  const pushSchool = (y: number, rowHeight: number, fontSize: number) => {
    if (!school) return;
    cells.push({
      text: school,
      bold: true,
      heading: true,
      school: true,
      x: 0,
      y,
      width: input.width,
      height: rowHeight * headingScale,
      fontSize: fitFont(school, input.width, fontSize * headingScale),
    });
  };

  if (sections.length === 1) {
    const s = sections[0]!;
    const columns = Math.max(1, Math.min(input.columns, s.lines.length));
    const rows = Math.ceil(s.lines.length / columns);
    // Alto total en «renglones de nombre»: así el achique es una sola cuenta lineal.
    const units = schoolUnits + rows + (s.heading ? headingScale + 2 * HEADING_GAP : 0);
    /*
     * En columnas, un nombre largo no debe cortarse en el borde de la suya: se achica todo por
     * igual hasta que entre el más largo (con el aire entre columnas, 0,8 cuerpos).
     */
    const widthFont =
      columns > 1
        ? input.width /
          (columns * Math.max(0.5, ...s.lines.map((l) => [...l.text].length * (l.bold ? AVG_CHAR_EM : AVG_NAME_CHAR_EM))) +
            0.8 * (columns - 1))
        : Number.POSITIVE_INFINITY;
    const rowHeight = Math.min(Math.min(input.fontSize, widthFont) * lineHeight, input.height / units);
    const fontSize = rowHeight / lineHeight;
    let y = alignTop(rowHeight * units);
    pushSchool(y, rowHeight, fontSize);
    y += rowHeight * schoolUnits;
    if (s.heading) {
      const h = rowHeight * headingScale;
      y += rowHeight * HEADING_GAP;
      cells.push({
        text: s.heading,
        bold: true,
        heading: true,
        x: 0,
        y,
        width: input.width,
        height: h,
        fontSize: fitFont(s.heading, input.width, fontSize * headingScale),
      });
      y += h + rowHeight * HEADING_GAP;
    }
    const gap = columns > 1 ? fontSize * 0.8 : 0;
    const cellWidth = Math.max(1, (input.width - gap * (columns - 1)) / columns);
    s.lines.forEach((line, i) => {
      const col = Math.floor(i / rows);
      const row = i % rows;
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
    return { cells, fontSize, columns };
  }

  // Varios cursos: una sola corrida en 4 columnas.
  const nameCount = sections.reduce((acc, s) => acc + s.lines.length, 0);
  const columns = Math.max(1, Math.min(CLASS_LIST_MULTI_COURSE_COLUMNS, nameCount));
  /*
   * En 4 columnas un nombre largo no entra al cuerpo elegido: se achica todo por igual hasta que
   * entre el más largo (antes de cortarse en el borde de la columna). `widthFont` es el cuerpo
   * más grande con el que entra, contando el aire entre columnas (0,8 cuerpos).
   */
  // El ancho del nombre más largo, en cuerpos. El destacado va en negrita, que es más ancha.
  const longestEm = Math.max(
    0.5,
    ...sections.flatMap((s) => s.lines.map((l) => [...l.text].length * (l.bold ? AVG_CHAR_EM : AVG_NAME_CHAR_EM))),
  );
  const gapsEm = 0.8 * (columns - 1);
  const widthFont = input.width / (columns * longestEm + gapsEm);
  const planFont = Math.min(input.fontSize, widthFont);
  const planCell = (input.width - planFont * gapsEm) / columns;
  const items: FlowItem[] = [];
  sections.forEach((s, si) => {
    const gapBefore = si > 0 ? SECTION_GAP : 0;
    if (s.heading) {
      /*
       * Un título que no entra en su columna ni al cuerpo de los nombres se parte en dos
       * renglones: el curso arriba y el turno abajo («3.° B» / «Turno mañana»). Achicarlo más
       * que los nombres lo dejaba ilegible.
       */
      const corte = s.heading.indexOf(" · ");
      const noEntra = [...s.heading].length * AVG_CHAR_EM * planFont * headingScale > planCell;
      const partir = noEntra && corte > 0;
      const sub = partir ? s.heading.slice(corte + 3) : null;
      items.push({
        kind: "heading",
        text: partir ? s.heading.slice(0, corte) : s.heading,
        sub,
        units: headingScale + (sub ? 1 : 0) + 2 * HEADING_GAP,
        gapBefore,
        keep: Math.min(KEEP_WITH_HEADING, s.lines.length),
      });
    }
    s.lines.forEach((line, i) =>
      items.push({ kind: "name", line, units: 1, gapBefore: i === 0 && !s.heading ? gapBefore : 0 }),
    );
  });
  const total = items.reduce((acc, it) => acc + it.gapBefore + it.units, 0);
  const tallest = items.reduce((acc, it) => Math.max(acc, it.units + (it.kind === "heading" ? it.keep : 0)), 0);
  // El alto de columna más chico con el que entra todo, buscado de a un vigésimo de renglón.
  let flow: { placed: FlowPlacement[]; used: number } | null = null;
  for (let limit = Math.max(total / columns, tallest); !flow; limit += 0.05) {
    flow = flowInto(items, columns, limit) ?? (limit >= total ? flowInto(items, columns, Number.POSITIVE_INFINITY) : null);
  }
  const units = schoolUnits + flow.used;
  const rowHeight = Math.min(planFont * lineHeight, input.height / units);
  const fontSize = rowHeight / lineHeight;
  const top = alignTop(rowHeight * units);
  pushSchool(top, rowHeight, fontSize);
  const y0 = top + rowHeight * schoolUnits;
  const gap = columns > 1 ? fontSize * 0.8 : 0;
  const cellWidth = Math.max(1, (input.width - gap * (columns - 1)) / columns);
  for (const p of flow.placed) {
    const x = p.col * (cellWidth + gap);
    const y = y0 + p.y * rowHeight + (p.item.kind === "heading" ? rowHeight * HEADING_GAP : 0);
    if (p.item.kind === "heading") {
      cells.push({
        text: p.item.text,
        bold: true,
        heading: true,
        x,
        y,
        width: cellWidth,
        height: rowHeight * headingScale,
        fontSize: fitFont(p.item.text, cellWidth, fontSize * headingScale),
      });
      if (p.item.sub) {
        cells.push({
          text: p.item.sub,
          bold: true,
          heading: true,
          x,
          y: y + rowHeight * headingScale,
          width: cellWidth,
          height: rowHeight,
          fontSize: fitFont(p.item.sub, cellWidth, fontSize),
        });
      }
    } else {
      cells.push({ ...p.item.line, heading: false, fontSize, x, y, width: cellWidth, height: rowHeight });
    }
  }
  return { cells, fontSize, columns };
}

/**
 * Lo que dibujan el lienzo, la vista previa y la impresión para un bloque «Listado del curso»:
 * los cursos ya ordenados, escritos y repartidos según las opciones del bloque.
 *
 * `schoolName` es el colegio del diseño (`school.name`); se imprime sólo si la opción «Mostrar
 * nombre del colegio» está prendida.
 */
export function layoutClassListBlock(input: {
  groups: readonly ClassListGroup[];
  options: ClassListOptions;
  width: number;
  height: number;
  fontSize: number;
  lineHeight: number;
  verticalAlign?: "top" | "middle" | "bottom";
  schoolName?: string | null;
}): ClassListSectionsLayout {
  return layoutClassListSections({
    sections: formatClassListGroups(input.groups, input.options),
    width: input.width,
    height: input.height,
    fontSize: input.fontSize,
    lineHeight: input.lineHeight,
    // Con dos cursos o más van siempre 4 columnas, para que entren los nombres.
    columns:
      input.groups.filter((g) => g.students.length > 0).length > 1
        ? CLASS_LIST_MULTI_COURSE_COLUMNS
        : input.options.columns,
    verticalAlign: input.verticalAlign,
    headingScale: input.options.headingScale,
    schoolName: input.options.showSchoolName ? input.schoolName : null,
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
export const CLASS_LIST_SAMPLE_TITLE = "3.° B";

/** El turno del curso de muestra. */
export const CLASS_LIST_SAMPLE_SHIFT = "Mañana";

/** El colegio de muestra (el mismo que el ejemplo de «Escuela - Nombre» del catálogo). */
export const CLASS_LIST_SAMPLE_SCHOOL = "Escuela Ejemplo";

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

/** El listado de muestra del editor: un curso con su título y su turno. */
export const CLASS_LIST_SAMPLE_GROUPS: ClassListGroup[] = [
  { title: CLASS_LIST_SAMPLE_TITLE, shift: CLASS_LIST_SAMPLE_SHIFT, students: CLASS_LIST_SAMPLE },
];
