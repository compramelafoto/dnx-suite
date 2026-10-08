import type { ClientPhotoSlot, TemplateV2Block, TemplateV2Canvas } from "@repo/template-editor-core";

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
};

export type DesignPhotoPayload = { id: number; url: string | null };

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
        .filter((k): k is string => typeof k === "string" && k.trim() !== ""),
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
  };
}

const TEXT_VARIABLE_LABELS: Record<string, string> = {
  "student.fullName": "Nombre del alumno",
  "buyer.fullName": "Nombre del cliente",
  "school.name": "Escuela",
  "course.displayName": "Curso",
  "order.referenceShort": "Referencia del pedido",
  "photographer.displayName": "Fotógrafo",
  "event.dateFormatted": "Fecha",
};

export function textVariableLabel(key: string): string {
  return TEXT_VARIABLE_LABELS[key] ?? key;
}
