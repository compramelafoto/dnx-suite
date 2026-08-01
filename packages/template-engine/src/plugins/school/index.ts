import type { TemplateVariablePlugin } from "../../variables/types";
import { SCHOOL_TEMPLATE_ALIASES } from "./aliases";
import { SCHOOL_TEMPLATE_VARIABLE_DEFINITIONS } from "./definitions";

export { SCHOOL_TEMPLATE_ALIASES } from "./aliases";
export { SCHOOL_TEMPLATE_VARIABLE_DEFINITIONS } from "./definitions";

/** Datos de ejemplo para preview/tests (sin red). */
export const SCHOOL_TEMPLATE_EXAMPLE_DATA: Record<string, unknown> = {
  "student.fullName": "María Gómez",
  "buyer.fullName": "Ana Rodríguez",
  "school.name": "Escuela Ejemplo",
  "course.displayName": "3.º B · Mañana",
  "order.referenceShort": "P-1024",
  "order.fulfillmentQrUrl": "https://ejemplo.com/escolar/entrega/preview",
  "photographer.displayName": "Estudio Fotográfico",
  "event.dateFormatted": "17/04/2026",
  "branding.schoolLogoUrl": "https://cdn.example.com/school-logo.png",
  "branding.photographerLogoUrl": "https://cdn.example.com/photographer-logo.png",
};

export const schoolTemplateVariablesPlugin: TemplateVariablePlugin = {
  id: "school",
  label: "ComprameLaFoto — Escolar",
  definitions: SCHOOL_TEMPLATE_VARIABLE_DEFINITIONS,
  aliases: SCHOOL_TEMPLATE_ALIASES,
};
