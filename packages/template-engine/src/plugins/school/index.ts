import type { TemplateVariablePlugin } from "../../variables/types";
import { SCHOOL_TEMPLATE_ALIASES } from "./aliases";
import { CLASS_LIST_SAMPLE_GROUPS, CLASS_LIST_VARIABLE_KEY, serializeClassListGroups } from "./class-list";
import {
  COURSE_MOSAIC_OWNER_VARIABLE_KEY,
  COURSE_MOSAIC_SAMPLE,
  COURSE_MOSAIC_VARIABLE_KEY,
  serializeCourseMosaic,
  serializeCourseMosaicOwner,
} from "./course-mosaic";
import {
  SCHOOL_CLIENT_PHOTO_PLACEHOLDER,
  SCHOOL_CLIENT_PHOTO_SLOT_COUNT,
  SCHOOL_NAMED_PHOTO_KEYS,
  SCHOOL_TEMPLATE_VARIABLE_DEFINITIONS,
} from "./definitions";

export { SCHOOL_TEMPLATE_ALIASES } from "./aliases";
export * from "./class-list";
export * from "./course-mosaic";
export {
  SCHOOL_CLIENT_PHOTO_PLACEHOLDER,
  SCHOOL_CLIENT_PHOTO_SLOT_COUNT,
  SCHOOL_GROUP_PHOTO_KEY,
  SCHOOL_INDIVIDUAL_PHOTO_KEY,
  SCHOOL_EXTRA_PHOTO_KEY,
  SCHOOL_FRIENDS_PHOTO_KEY,
  SCHOOL_NAMED_PHOTO_KEYS,
  SCHOOL_TEACHER_PHOTO_KEY,
  SCHOOL_TEMPLATE_VARIABLE_DEFINITIONS,
} from "./definitions";

/** Datos de ejemplo para preview/tests (sin red). */
export const SCHOOL_TEMPLATE_EXAMPLE_DATA: Record<string, unknown> = {
  "student.fullName": "María Gómez",
  "buyer.fullName": "Ana Rodríguez",
  "school.name": "Escuela Ejemplo",
  "course.displayName": "3.º B · Mañana",
  [CLASS_LIST_VARIABLE_KEY]: serializeClassListGroups(CLASS_LIST_SAMPLE_GROUPS),
  // Los compañeros de muestra se ven sólo en el editor y en las vistas de ejemplo: una carpeta
  // real sin compañeros no dibuja ninguno.
  [COURSE_MOSAIC_VARIABLE_KEY]: serializeCourseMosaic(COURSE_MOSAIC_SAMPLE),
  [COURSE_MOSAIC_OWNER_VARIABLE_KEY]: serializeCourseMosaicOwner({ firstName: "María", lastName: "Gómez" }),
  "order.referenceShort": "P-1024",
  "order.fulfillmentQrUrl": "https://ejemplo.com/escolar/entrega/preview",
  "photographer.displayName": "Estudio Fotográfico",
  "event.dateFormatted": "17/04/2026",
  "branding.schoolLogoUrl": "https://cdn.example.com/school-logo.png",
  "branding.photographerLogoUrl": "https://cdn.example.com/photographer-logo.png",
  ...Object.fromEntries(SCHOOL_NAMED_PHOTO_KEYS.map((k) => [k, SCHOOL_CLIENT_PHOTO_PLACEHOLDER])),
  ...Object.fromEntries(
    Array.from({ length: SCHOOL_CLIENT_PHOTO_SLOT_COUNT }, (_, i) => [
      `photo_${i + 1}`,
      SCHOOL_CLIENT_PHOTO_PLACEHOLDER,
    ]),
  ),
};

export const schoolTemplateVariablesPlugin: TemplateVariablePlugin = {
  id: "school",
  label: "ComprameLaFoto — Escolar",
  definitions: SCHOOL_TEMPLATE_VARIABLE_DEFINITIONS,
  aliases: SCHOOL_TEMPLATE_ALIASES,
};
