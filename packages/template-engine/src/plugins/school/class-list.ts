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
};

export const CLASS_LIST_MAX_COLUMNS = 4;

export const DEFAULT_CLASS_LIST_OPTIONS: ClassListOptions = {
  sortBy: "lastName",
  nameOrder: "firstLast",
  givenNames: "all",
  highlightOwner: true,
  columns: 2,
};

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
  };
}

export function serializeClassList(students: readonly ClassListStudent[]): string {
  return JSON.stringify(
    students.map((s) => (s.isOwner ? { f: s.firstName, l: s.lastName, o: 1 } : { f: s.firstName, l: s.lastName })),
  );
}

/** Lee la lista desde el texto de la variable. Algo que no se entiende es una lista vacía. */
export function parseClassListValue(raw: unknown): ClassListStudent[] {
  if (typeof raw !== "string" || !raw.trim().startsWith("[")) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
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
 */
export function layoutClassList(input: {
  lines: readonly ClassListLine[];
  width: number;
  height: number;
  fontSize: number;
  lineHeight: number;
  columns: number;
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
  const cells = lines.map((line, i) => {
    const col = Math.floor(i / rows);
    const row = i % rows;
    return { ...line, x: col * (cellWidth + gap), y: row * rowHeight, width: cellWidth, height: rowHeight };
  });
  return { cells, fontSize };
}

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
