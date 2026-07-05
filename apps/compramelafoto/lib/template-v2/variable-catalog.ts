export type TemplateV2VariableGroupId =
  | "student"
  | "buyer"
  | "school"
  | "course"
  | "order"
  | "photographer"
  | "event"
  | "branding";

export type TemplateV2VariableValueType = "string" | "date" | "imageUrl" | "qrUrl";

export type TemplateV2VariableUsableIn = "TEXT" | "IMAGE";

export type TemplateV2VariableFormatterV1 =
  | "none"
  | "uppercase"
  | "titleCase"
  | "truncate"
  | "date.short";

export type TemplateV2VariableDefinition = {
  key: string;
  label: string;
  group: TemplateV2VariableGroupId;
  valueType: TemplateV2VariableValueType;
  usableIn: TemplateV2VariableUsableIn[];
  requiredInV1: boolean;
  defaultFallback: string | null;
  formatters: TemplateV2VariableFormatterV1[];
  description: string;
  sourcePath: string;
};

export type TemplateV2VariableGroup = {
  id: TemplateV2VariableGroupId;
  label: string;
  variables: TemplateV2VariableDefinition[];
};

export type TemplateV2VariableCatalog = {
  version: string;
  groups: TemplateV2VariableGroup[];
};

export const TEMPLATE_V2_VARIABLE_CATALOG_VERSION = "v1";

export const TEMPLATE_V2_VARIABLE_FORMATTERS_V1: TemplateV2VariableFormatterV1[] = [
  "none",
  "uppercase",
  "titleCase",
  "truncate",
  "date.short",
];

export const TEMPLATE_V2_VARIABLE_CATALOG: TemplateV2VariableCatalog = {
  version: TEMPLATE_V2_VARIABLE_CATALOG_VERSION,
  groups: [
    {
      id: "student",
      label: "Alumno",
      variables: [
        {
          key: "student.fullName",
          label: "Alumno - Nombre completo",
          group: "student",
          valueType: "string",
          usableIn: ["TEXT"],
          requiredInV1: true,
          defaultFallback: "—",
          formatters: ["none", "uppercase", "titleCase", "truncate"],
          description: "Nombre y apellido del alumno.",
          sourcePath: "PreCompraOrder.studentFirstName + PreCompraOrder.studentLastName",
        },
      ],
    },
    {
      id: "buyer",
      label: "Cliente",
      variables: [
        {
          key: "buyer.fullName",
          label: "Cliente - Nombre completo",
          group: "buyer",
          valueType: "string",
          usableIn: ["TEXT"],
          requiredInV1: true,
          defaultFallback: "—",
          formatters: ["none", "uppercase", "titleCase", "truncate"],
          description: "Nombre del comprador o adulto responsable.",
          sourcePath: "PreCompraOrder.buyerName",
        },
      ],
    },
    {
      id: "school",
      label: "Escuela",
      variables: [
        {
          key: "school.name",
          label: "Escuela - Nombre",
          group: "school",
          valueType: "string",
          usableIn: ["TEXT"],
          requiredInV1: true,
          defaultFallback: "—",
          formatters: ["none", "uppercase", "titleCase", "truncate"],
          description: "Nombre de la institución escolar.",
          sourcePath: "Album.school.name",
        },
      ],
    },
    {
      id: "course",
      label: "Curso",
      variables: [
        {
          key: "course.displayName",
          label: "Curso - Nombre visible",
          group: "course",
          valueType: "string",
          usableIn: ["TEXT"],
          requiredInV1: true,
          defaultFallback: "—",
          formatters: ["none", "uppercase", "titleCase", "truncate"],
          description: "Nombre de curso y división listo para imprimir.",
          sourcePath: "SchoolCourse.name + SchoolCourse.division",
        },
      ],
    },
    {
      id: "order",
      label: "Pedido",
      variables: [
        {
          key: "order.referenceShort",
          label: "Pedido - Referencia corta",
          group: "order",
          valueType: "string",
          usableIn: ["TEXT"],
          requiredInV1: true,
          defaultFallback: "—",
          formatters: ["none", "uppercase", "truncate"],
          description: "Referencia corta de seguimiento del pedido/ítem.",
          sourcePath: "PreCompraOrderItem.fulfillmentQrToken (transformado)",
        },
        {
          key: "order.fulfillmentQrUrl",
          label: "Pedido - URL QR de entrega",
          group: "order",
          valueType: "qrUrl",
          usableIn: ["TEXT"],
          requiredInV1: true,
          defaultFallback: "—",
          formatters: ["none"],
          description: "URL final codificada en el QR de entrega.",
          sourcePath: "baseUrl + /escolar/entrega/:token",
        },
      ],
    },
    {
      id: "photographer",
      label: "Fotógrafo",
      variables: [
        {
          key: "photographer.displayName",
          label: "Fotógrafo - Nombre público",
          group: "photographer",
          valueType: "string",
          usableIn: ["TEXT"],
          requiredInV1: true,
          defaultFallback: "—",
          formatters: ["none", "uppercase", "titleCase", "truncate"],
          description: "Nombre de marca o nombre público del fotógrafo.",
          sourcePath: "User.name / profile.displayName",
        },
      ],
    },
    {
      id: "event",
      label: "Evento",
      variables: [
        {
          key: "event.dateFormatted",
          label: "Evento - Fecha formateada",
          group: "event",
          valueType: "date",
          usableIn: ["TEXT"],
          requiredInV1: true,
          defaultFallback: "—",
          formatters: ["none", "date.short"],
          description: "Fecha del evento en formato corto para impresión.",
          sourcePath: "Album.eventDate / Event.date",
        },
      ],
    },
    {
      id: "branding",
      label: "Marca",
      variables: [
        {
          key: "branding.schoolLogoUrl",
          label: "Marca - Logo escuela",
          group: "branding",
          valueType: "imageUrl",
          usableIn: ["IMAGE"],
          requiredInV1: true,
          defaultFallback: null,
          formatters: ["none"],
          description:
            "Logo institucional de la escuela (idealmente PNG con fondo transparente, el mismo que se carga al dar de alta la escuela).",
          sourcePath: "School.logoUrl",
        },
        {
          key: "branding.photographerLogoUrl",
          label: "Marca - Logo fotógrafo",
          group: "branding",
          valueType: "imageUrl",
          usableIn: ["IMAGE"],
          requiredInV1: true,
          defaultFallback: null,
          formatters: ["none"],
          description: "Logo del estudio/fotógrafo.",
          sourcePath: "PhotographerBrand.logoUrl",
        },
      ],
    },
  ],
};

export const TEMPLATE_V2_VARIABLE_MAP: Record<string, TemplateV2VariableDefinition> =
  TEMPLATE_V2_VARIABLE_CATALOG.groups.reduce<Record<string, TemplateV2VariableDefinition>>(
    (acc, group) => {
      for (const variable of group.variables) {
        acc[variable.key] = variable;
      }
      return acc;
    },
    {}
  );

export const TEMPLATE_V2_VARIABLE_KEYS_V1_REQUIRED: string[] = Object.values(
  TEMPLATE_V2_VARIABLE_MAP
)
  .filter((v) => v.requiredInV1)
  .map((v) => v.key);

export function getTemplateV2VariableByKey(key: string): TemplateV2VariableDefinition | undefined {
  return TEMPLATE_V2_VARIABLE_MAP[key];
}

export function isTemplateV2VariableUsableIn(
  key: string,
  target: TemplateV2VariableUsableIn
): boolean {
  const variable = getTemplateV2VariableByKey(key);
  if (!variable) return false;
  return variable.usableIn.includes(target);
}

/** Grupos del catálogo filtrados a variables usables en bloques de texto (TEXT / VARIABLE_TEXT). */
export function getTemplateV2VariableGroupsForTextBlocks(): TemplateV2VariableGroup[] {
  return TEMPLATE_V2_VARIABLE_CATALOG.groups
    .map((g) => ({
      ...g,
      variables: g.variables.filter((v) => v.usableIn.includes("TEXT")),
    }))
    .filter((g) => g.variables.length > 0);
}
