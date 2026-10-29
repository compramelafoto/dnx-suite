import {
  CALENDAR_VARIABLE_KEY,
  CALENDAR_YEAR_VARIABLE_KEY,
  CLASS_LIST_VARIABLE_KEY,
  COURSE_MOSAIC_VARIABLE_KEY,
  COURSE_MOSAIC_OWNER_VARIABLE_KEY,
} from "@repo/template-editor-core";
import type { ClientPhotoSlot, TemplateV2Block, TemplateV2Canvas } from "@repo/template-editor-core";

const SIN_CORRECCION = new Set([
  CLASS_LIST_VARIABLE_KEY,
  COURSE_MOSAIC_VARIABLE_KEY,
  COURSE_MOSAIC_OWNER_VARIABLE_KEY,
  CALENDAR_VARIABLE_KEY,
  CALENDAR_YEAR_VARIABLE_KEY,
]);

/**
 * Lo que la pantalla de diseño necesita de una plantilla para dibujarla en el navegador.
 * Puro y serializable: viaja como JSON de las rutas al componente.
 */
export type DesignTemplatePayload = {
  templateId: string;
  versionId: string;
  name: string;
  canvas: TemplateV2Canvas;
  blocks: TemplateV2Block[];
  slots: ClientPhotoSlot[];
  pageCount: number;
  pageLabels: string[];
  /** Variables de texto que usa la plantilla (para poder corregir nombre, curso, etc.). */
  textVariables: string[];
  /**
   * Si se dobla como un librito (y se puede ver en 3D). Los diplomas, calendarios y demás
   * productos planos dicen `false` en su meta (`plegado`); sin dato, se deduce por la forma.
   */
  plegado?: boolean;
};

export type DesignPhotoPayload = {
  id: number;
  url: string | null;
  /** El recorte sin fondo, si se pidió: se usa en los huecos «Quitar el fondo». */
  cutout?: { status: string; url: string | null; error: string | null };
};

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

export function toDesignTemplatePayload(template: {
  templateId: string;
  versionId: string;
  name: string;
  legacy: { canvas: unknown; blocks: unknown[]; meta?: unknown };
  slots: ClientPhotoSlot[];
  pageCount: number;
}): DesignTemplatePayload {
  const meta = asRecord(template.legacy.meta);
  const pageLabels = Array.isArray(meta.pageLabels)
    ? meta.pageLabels.map((l) => (typeof l === "string" ? l : ""))
    : [];
  const blocks = template.legacy.blocks as TemplateV2Block[];
  const textVariables = [
    ...new Set(
      blocks
        .filter((b) => b.type === "VARIABLE_TEXT")
        .map((b) => asRecord(b.configJson).variableKey)
        // El listado y el mosaico del curso no se corrigen a mano como un texto: salen del padrón.
        // El calendario y su año son de la plantilla entera (un año distinto en un solo diseño
        // dejaría el título diciendo un año y los días otro). El título y el motivo del diploma
        // sí se pueden cambiar para un alumno.
        .filter((k): k is string => typeof k === "string" && k.trim() !== "" && !SIN_CORRECCION.has(k)),
    ),
  ];
  return {
    templateId: template.templateId,
    versionId: template.versionId,
    name: template.name,
    canvas: template.legacy.canvas as TemplateV2Canvas,
    blocks,
    slots: template.slots,
    pageCount: template.pageCount,
    pageLabels,
    textVariables,
    ...(typeof meta.plegado === "boolean" ? { plegado: meta.plegado } : {}),
  };
}

const TEXT_VARIABLE_LABELS: Record<string, string> = {
  "student.fullName": "Nombre del alumno",
  "student.firstName": "Nombre del alumno (sin apellido)",
  "student.lastName": "Apellido del alumno",
  "student.lastNameFirst": "Apellido y nombre del alumno",
  "buyer.fullName": "Nombre del cliente",
  "school.name": "Escuela",
  "course.displayName": "Curso",
  "course.withSchool": "Curso y colegio",
  "school.withCourse": "Colegio y curso",
  "order.referenceShort": "Referencia del pedido",
  "photographer.displayName": "Fotógrafo",
  "event.dateFormatted": "Fecha",
};

export function textVariableLabel(key: string): string {
  return TEXT_VARIABLE_LABELS[key] ?? key;
}
