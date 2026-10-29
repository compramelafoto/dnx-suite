/**
 * «Datos de la plantilla»: lo que el fotógrafo escribe una sola vez para toda la plantilla (el
 * título, el motivo y la fecha del diploma; el año del calendario) y vale para todos los alumnos.
 *
 * No viven en los valores de cada diseño, sino en los mismos bloques: el texto es el respaldo
 * (`fallback`) de cada bloque atado a esa variable, y el año va además en las opciones de cada
 * bloque «Calendario». Así la plantilla se ve igual en el editor, en «Probar», en la vista de la
 * familia y en el PDF, sin que cada camino tenga que ir a buscarlo. Si algún día un diseño trae
 * su propio valor (un diploma con otro motivo para un alumno), ese valor manda.
 */
import { CALENDAR_VARIABLE_KEY, CALENDAR_YEAR_VARIABLE_KEY, parseCalendarYear } from "./calendar";

export const DIPLOMA_TITLE_VARIABLE_KEY = "diploma.title";
export const DIPLOMA_REASON_VARIABLE_KEY = "diploma.reason";
export const DIPLOMA_DATE_VARIABLE_KEY = "diploma.date";

export type TemplateDataField = {
  key: string;
  label: string;
  /** Ayuda corta para el fotógrafo. */
  hint: string;
  placeholder: string;
  multiline?: boolean;
};

/** Los datos de la plantilla, en el orden en que se piden. */
export const TEMPLATE_DATA_FIELDS: readonly TemplateDataField[] = [
  {
    key: DIPLOMA_TITLE_VARIABLE_KEY,
    label: "Título del diploma",
    hint: "Lo que dice arriba, en grande.",
    placeholder: "Diploma de honor",
  },
  {
    key: DIPLOMA_REASON_VARIABLE_KEY,
    label: "Motivo",
    hint: "Por qué se entrega. Va debajo del nombre del alumno.",
    placeholder: "Por haber finalizado con éxito el Nivel Inicial",
    multiline: true,
  },
  {
    key: DIPLOMA_DATE_VARIABLE_KEY,
    label: "Fecha del diploma",
    hint: "Como se tiene que leer: «Diciembre de 2026» o «18 de diciembre de 2026».",
    placeholder: "Diciembre de 2026",
  },
  {
    key: CALENDAR_YEAR_VARIABLE_KEY,
    label: "Año del calendario",
    hint: "Los meses y los días se acomodan solos a ese año.",
    placeholder: "2027",
  },
];

export type BlockForTemplateData = { type: string; configJson: unknown };

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function claveDelTexto(b: BlockForTemplateData): string | null {
  if (b.type !== "VARIABLE_TEXT") return null;
  const k = asRecord(b.configJson).variableKey;
  return typeof k === "string" ? k : null;
}

/** Los datos de la plantilla que usan estos bloques (sólo los que aparecen), con su texto actual. */
export function readTemplateData(blocks: readonly BlockForTemplateData[]): Array<TemplateDataField & { value: string }> {
  const out: Array<TemplateDataField & { value: string }> = [];
  for (const f of TEMPLATE_DATA_FIELDS) {
    let usado = false;
    let valor = "";
    for (const b of blocks) {
      const k = claveDelTexto(b);
      if (k === f.key) {
        usado = true;
        const fb = asRecord(b.configJson).fallback;
        if (!valor && typeof fb === "string") valor = fb;
      }
      if (f.key === CALENDAR_YEAR_VARIABLE_KEY && k === CALENDAR_VARIABLE_KEY) {
        usado = true;
        const y = parseCalendarYear(asRecord(asRecord(b.configJson).calendar).year);
        if (!valor && y != null) valor = String(y);
      }
    }
    if (usado) out.push({ ...f, value: valor });
  }
  return out;
}

/**
 * Escribe un dato de la plantilla en todos los bloques que lo usan. Devuelve los bloques nuevos
 * (los que no cambian, iguales). El año del calendario sólo se escribe si es un año válido.
 */
export function applyTemplateData<T extends BlockForTemplateData>(blocks: readonly T[], key: string, value: string): T[] {
  const anio = key === CALENDAR_YEAR_VARIABLE_KEY ? parseCalendarYear(value) : null;
  return blocks.map((b) => {
    const k = claveDelTexto(b);
    const cfg = asRecord(b.configJson);
    if (k === key) {
      if (key === CALENDAR_YEAR_VARIABLE_KEY && anio == null) return b;
      return { ...b, configJson: { ...cfg, fallback: key === CALENDAR_YEAR_VARIABLE_KEY ? String(anio) : value } };
    }
    if (key === CALENDAR_YEAR_VARIABLE_KEY && k === CALENDAR_VARIABLE_KEY && anio != null) {
      return { ...b, configJson: { ...cfg, calendar: { ...asRecord(cfg.calendar), year: anio } } };
    }
    return b;
  });
}
