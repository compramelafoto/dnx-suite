import type { TemplateVariableDefinition } from "../../variables/types";
import { CLASS_LIST_SAMPLE, CLASS_LIST_VARIABLE_KEY, serializeClassList } from "./class-list";

/** Cuántos huecos de "foto del cliente" ofrece el catálogo: `photo_1` … `photo_12`. */
export const SCHOOL_CLIENT_PHOTO_SLOT_COUNT = 12;

/** Gris liso, sin red: lo que muestra la vista previa del editor en un hueco de foto. */
export const SCHOOL_CLIENT_PHOTO_PLACEHOLDER =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAGCAIAAABxZ0isAAAAEUlEQVR4nGN49OIDVsQwkBIAV9CC4fMnHZAAAAAASUVORK5CYII=";

/**
 * Huecos que se llenan con las fotos que eligió el cliente, en el orden en que las eligió.
 *
 * Las plantillas escolares ya usaban `photo_1`, `photo_2` y `photo_3` (la "Carpeta escolar 3
 * fotos"), pero el catálogo no las declaraba: la vista previa del editor las rechazaba como
 * "variable de imagen inválida" y no había forma de ver el diseño.
 */
const SCHOOL_CLIENT_PHOTO_DEFINITIONS: TemplateVariableDefinition[] = Array.from(
  { length: SCHOOL_CLIENT_PHOTO_SLOT_COUNT },
  (_, i) => ({
    path: `photo_${i + 1}`,
    label: `Foto del cliente ${i + 1}`,
    description: `La foto número ${i + 1} que elige el cliente al canjear o comprar el pack.`,
    valueType: "image" as const,
    required: false,
    example: SCHOOL_CLIENT_PHOTO_PLACEHOLDER,
    formatters: ["none"],
    usableIn: ["IMAGE" as const],
    defaultFallback: null,
    group: "photos",
    groupLabel: "Fotos del cliente",
  }),
);

/**
 * Definiciones escolares (solo catálogo).
 * Sin Prisma, pedidos ni resolución de negocio — el caller entrega `data`.
 */
export const SCHOOL_TEMPLATE_VARIABLE_DEFINITIONS: TemplateVariableDefinition[] = [
  {
    path: "student.fullName",
    label: "Alumno - Nombre completo",
    description: "Nombre y apellido del alumno.",
    valueType: "text",
    required: true,
    example: "María Gómez",
    aliases: ["alumno", "nombredelalumno", "nombrecompleto", "apellido"],
    formatters: ["none", "uppercase", "titleCase", "truncate"],
    usableIn: ["TEXT"],
    defaultFallback: "—",
    group: "student",
    groupLabel: "Alumno",
  },
  {
    path: "buyer.fullName",
    label: "Cliente - Nombre completo",
    description: "Nombre del comprador o adulto responsable.",
    valueType: "text",
    required: true,
    example: "Ana Rodríguez",
    aliases: ["cliente", "comprador"],
    formatters: ["none", "uppercase", "titleCase", "truncate"],
    usableIn: ["TEXT"],
    defaultFallback: "—",
    group: "buyer",
    groupLabel: "Cliente",
  },
  {
    path: "school.name",
    label: "Escuela - Nombre",
    description: "Nombre de la institución escolar.",
    valueType: "text",
    required: true,
    example: "Escuela Ejemplo",
    aliases: ["escuela", "colegio"],
    formatters: ["none", "uppercase", "titleCase", "truncate"],
    usableIn: ["TEXT"],
    defaultFallback: "—",
    group: "school",
    groupLabel: "Escuela",
  },
  {
    path: "course.displayName",
    label: "Curso - Nombre visible",
    description: "Nombre de curso y división listo para imprimir.",
    valueType: "text",
    required: true,
    example: "3.º B · Mañana",
    aliases: ["curso", "division"],
    formatters: ["none", "uppercase", "titleCase", "truncate"],
    usableIn: ["TEXT"],
    defaultFallback: "—",
    group: "course",
    groupLabel: "Curso",
  },
  {
    path: CLASS_LIST_VARIABLE_KEY,
    label: "Curso - Listado de alumnos",
    description: "Todos los alumnos del curso, para el bloque «Listado del curso».",
    valueType: "text",
    required: false,
    example: serializeClassList(CLASS_LIST_SAMPLE),
    formatters: ["none"],
    // No es un texto para insertar: es una lista que sólo sabe dibujar su propio bloque.
    usableIn: ["LIST"],
    defaultFallback: null,
    group: "course",
    groupLabel: "Curso",
  },
  {
    path: "order.referenceShort",
    label: "Pedido - Referencia corta",
    description: "Referencia corta de seguimiento del pedido/ítem.",
    valueType: "text",
    required: true,
    example: "P-1024",
    aliases: ["pedido", "referencia"],
    formatters: ["none", "uppercase", "truncate"],
    usableIn: ["TEXT"],
    defaultFallback: "—",
    group: "order",
    groupLabel: "Pedido",
  },
  {
    path: "order.fulfillmentQrUrl",
    label: "Pedido - URL QR de entrega",
    description: "URL final codificada en el QR de entrega.",
    valueType: "qrUrl",
    required: true,
    example: "https://ejemplo.com/escolar/entrega/preview",
    aliases: ["qr"],
    formatters: ["none"],
    usableIn: ["TEXT"],
    defaultFallback: "—",
    group: "order",
    groupLabel: "Pedido",
  },
  {
    path: "photographer.displayName",
    label: "Fotógrafo - Nombre público",
    description: "Nombre de marca o nombre público del fotógrafo.",
    valueType: "text",
    required: true,
    example: "Estudio Fotográfico",
    aliases: ["fotografo"],
    formatters: ["none", "uppercase", "titleCase", "truncate"],
    usableIn: ["TEXT"],
    defaultFallback: "—",
    group: "photographer",
    groupLabel: "Fotógrafo",
  },
  {
    path: "event.dateFormatted",
    label: "Evento - Fecha formateada",
    description: "Fecha del evento en formato corto para impresión.",
    valueType: "date",
    required: true,
    example: "17/04/2026",
    aliases: ["anio", "ano", "fecha"],
    formatters: ["none", "date.short"],
    usableIn: ["TEXT"],
    defaultFallback: "—",
    group: "event",
    groupLabel: "Evento",
  },
  {
    path: "branding.schoolLogoUrl",
    label: "Marca - Logo escuela",
    description: "Logo institucional de la escuela (PNG transparente preferido).",
    valueType: "image",
    required: true,
    example: "https://cdn.example.com/school-logo.png",
    formatters: ["none"],
    usableIn: ["IMAGE"],
    defaultFallback: null,
    group: "branding",
    groupLabel: "Marca",
  },
  {
    path: "branding.photographerLogoUrl",
    label: "Marca - Logo fotógrafo",
    description: "Logo del estudio/fotógrafo.",
    valueType: "image",
    required: true,
    example: "https://cdn.example.com/photographer-logo.png",
    formatters: ["none"],
    usableIn: ["IMAGE"],
    defaultFallback: null,
    group: "branding",
    groupLabel: "Marca",
  },
  ...SCHOOL_CLIENT_PHOTO_DEFINITIONS,
];
