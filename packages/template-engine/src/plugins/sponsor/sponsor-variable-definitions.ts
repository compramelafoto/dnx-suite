import type { TemplateVariableDefinition } from "../../variables/types";

const TEXT_FMT = ["none", "uppercase", "lowercase", "capitalize", "trim"] as const;

const SPONSOR_GROUP = "sponsor";
const SPONSOR_GROUP_LABEL = "SPONSOR — AGRADECIMIENTO";
const PROGRAM_GROUP = "program";
const PROGRAM_GROUP_LABEL = "PROGRAMA — AGRADECIMIENTO";

/**
 * Variables compartidas por las placas de agradecimiento a sponsors.
 *
 * Son product-agnostic a propósito: la misma placa sirve para agradecer una
 * participación en Clickatón o en FotoRank; sólo cambian los valores de
 * `program.*` y el preset elegido.
 */
export const SPONSOR_TEMPLATE_VARIABLE_DEFINITIONS: TemplateVariableDefinition[] = [
  {
    path: "sponsor.name",
    label: "Sponsor - Nombre",
    valueType: "text",
    example: "Óptica Del Centro",
    formatters: [...TEXT_FMT],
    usableIn: ["TEXT"],
    defaultFallback: "",
    group: SPONSOR_GROUP,
    groupLabel: SPONSOR_GROUP_LABEL,
  },
  {
    path: "sponsor.logoUrl",
    label: "Sponsor - Logo",
    description: "Data URL o URL https del logo del sponsor.",
    valueType: "image",
    example: "",
    formatters: ["none"],
    usableIn: ["IMAGE"],
    defaultFallback: null,
    aliases: ["sponsor.logo"],
    group: SPONSOR_GROUP,
    groupLabel: SPONSOR_GROUP_LABEL,
  },
  {
    path: "sponsor.tierLabel",
    label: "Sponsor - Categoría",
    description: "Etiqueta visible: Sponsor oficial, Auspiciante, Colaborador…",
    valueType: "text",
    example: "SPONSOR OFICIAL",
    formatters: [...TEXT_FMT],
    usableIn: ["TEXT"],
    defaultFallback: "",
    group: SPONSOR_GROUP,
    groupLabel: SPONSOR_GROUP_LABEL,
  },
  {
    path: "sponsor.instagram",
    label: "Sponsor - Instagram",
    valueType: "text",
    example: "@opticadelcentro",
    formatters: [...TEXT_FMT],
    usableIn: ["TEXT"],
    defaultFallback: "",
    group: SPONSOR_GROUP,
    groupLabel: SPONSOR_GROUP_LABEL,
  },
  {
    path: "sponsor.website",
    label: "Sponsor - Sitio web",
    valueType: "text",
    example: "opticadelcentro.com.ar",
    formatters: [...TEXT_FMT],
    usableIn: ["TEXT"],
    defaultFallback: "",
    group: SPONSOR_GROUP,
    groupLabel: SPONSOR_GROUP_LABEL,
  },
  {
    path: "sponsor.message",
    label: "Sponsor - Mensaje de agradecimiento",
    valueType: "text",
    example:
      "Gracias por acompañar a la comunidad de fotógrafas y fotógrafos que hace posible este encuentro.",
    formatters: [...TEXT_FMT],
    usableIn: ["TEXT"],
    defaultFallback: "",
    group: SPONSOR_GROUP,
    groupLabel: SPONSOR_GROUP_LABEL,
  },

  {
    path: "program.productLabel",
    label: "Programa - Producto",
    description: "Clickatón o FotoRank.",
    valueType: "text",
    example: "CLICKATÓN",
    formatters: [...TEXT_FMT],
    usableIn: ["TEXT"],
    defaultFallback: "",
    group: PROGRAM_GROUP,
    groupLabel: PROGRAM_GROUP_LABEL,
  },
  {
    path: "program.name",
    label: "Programa - Nombre",
    description: "Edición de Clickatón o concurso de FotoRank.",
    valueType: "text",
    example: "Clickatón Córdoba 2026",
    formatters: [...TEXT_FMT],
    usableIn: ["TEXT"],
    defaultFallback: "",
    group: PROGRAM_GROUP,
    groupLabel: PROGRAM_GROUP_LABEL,
  },
  {
    path: "program.dateFormatted",
    label: "Programa - Fecha",
    valueType: "text",
    example: "11 DE OCTUBRE",
    formatters: [...TEXT_FMT],
    usableIn: ["TEXT"],
    defaultFallback: "",
    group: PROGRAM_GROUP,
    groupLabel: PROGRAM_GROUP_LABEL,
  },
  {
    path: "program.city",
    label: "Programa - Ciudad",
    valueType: "text",
    example: "Córdoba",
    formatters: [...TEXT_FMT],
    usableIn: ["TEXT"],
    defaultFallback: "",
    group: PROGRAM_GROUP,
    groupLabel: PROGRAM_GROUP_LABEL,
  },
  {
    path: "program.metaLine",
    label: "Programa - Fecha y ciudad",
    description:
      "Fecha y ciudad ya combinadas; omite el separador si falta alguna de las dos.",
    valueType: "text",
    example: "11 DE OCTUBRE · Córdoba",
    formatters: [...TEXT_FMT],
    usableIn: ["TEXT"],
    defaultFallback: "",
    group: PROGRAM_GROUP,
    groupLabel: PROGRAM_GROUP_LABEL,
  },
  {
    path: "program.logoUrl",
    label: "Programa - Logo",
    valueType: "image",
    example: "",
    formatters: ["none"],
    usableIn: ["IMAGE"],
    defaultFallback: null,
    aliases: ["program.logo"],
    group: PROGRAM_GROUP,
    groupLabel: PROGRAM_GROUP_LABEL,
  },
  {
    path: "program.participantsCount",
    label: "Programa - Participantes",
    description: "Cantidad de fotógrafas/os que participaron.",
    valueType: "text",
    example: "135",
    formatters: [...TEXT_FMT],
    usableIn: ["TEXT"],
    defaultFallback: "",
    group: PROGRAM_GROUP,
    groupLabel: PROGRAM_GROUP_LABEL,
  },
];

export const SPONSOR_TEMPLATE_ALIASES: Record<string, string> = {
  "sponsor.logo": "sponsor.logoUrl",
  "program.logo": "program.logoUrl",
  "program.edition": "program.name",
  "program.contest": "program.name",
};
