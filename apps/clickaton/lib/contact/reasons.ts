/** Motivos estables del formulario de contacto Clickatón. */
export const CONTACT_REASON_OPTIONS = [
  {
    value: "formar-parte",
    label: "Formá parte / Aliados",
    description: "Empresas e instituciones que quieren acompañar Clickatón.",
  },
  {
    value: "aliados",
    label: "Aliados Fundadores",
    description: "Marcas que quieren construir el primer capítulo.",
  },
  {
    value: "participar",
    label: "Participar",
    description: "Consultas sobre próximas ediciones y cómo sumarte.",
  },
  {
    value: "organizar",
    label: "Organizar una sede",
    description: "Interés en el programa de sedes y acompañamiento.",
  },
  {
    value: "prensa",
    label: "Prensa",
    description: "Cobertura, entrevistas y material institucional.",
  },
  {
    value: "alianzas",
    label: "Alianzas",
    description: "Instituciones, clubes y organizaciones afines.",
  },
  {
    value: "general",
    label: "Consultas generales",
    description: "Otras preguntas sobre Clickatón.",
  },
] as const;

export type ContactReasonValue = (typeof CONTACT_REASON_OPTIONS)[number]["value"];

const REASON_SET = new Set<string>(CONTACT_REASON_OPTIONS.map((r) => r.value));

/** Query params conocidos → motivo del formulario. */
const MOTIVO_ALIASES: Record<string, ContactReasonValue> = {
  "formar-parte": "formar-parte",
  aliados: "aliados",
  participar: "participar",
  organizar: "organizar",
  prensa: "prensa",
  alianzas: "alianzas",
  general: "general",
};

export function isContactReason(value: string): value is ContactReasonValue {
  return REASON_SET.has(value);
}

export function resolveContactReason(
  raw: string | null | undefined,
): ContactReasonValue {
  if (!raw) return "general";
  const key = raw.trim().toLowerCase();
  return MOTIVO_ALIASES[key] ?? (isContactReason(key) ? key : "general");
}

export function contactReasonLabel(value: string): string {
  return CONTACT_REASON_OPTIONS.find((r) => r.value === value)?.label ?? value;
}
