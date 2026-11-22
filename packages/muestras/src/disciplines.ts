/**
 * Disciplinas de Muestras de Arte: lista fija. Van como texto y no como enum de Prisma
 * (mismo criterio que `constants.ts`).
 */
export const DISCIPLINES = [
  "FOTOGRAFIA",
  "PINTURA",
  "DIBUJO",
  "GRABADO",
  "ILUSTRACION",
  "COLLAGE",
  "ESCULTURA",
  "CERAMICA",
  "TEXTIL",
  "JOYERIA",
  "INSTALACION",
  "ARTE_DIGITAL",
  "VIDEOARTE",
  "ARTE_SONORO",
  "ARTE_URBANO",
  "OTRA",
] as const;
export type Discipline = (typeof DISCIPLINES)[number];

export const PHOTOGRAPHY = "FOTOGRAFIA" as const;

export const DISCIPLINE_LABELS: Record<Discipline, string> = {
  FOTOGRAFIA: "Fotografía",
  PINTURA: "Pintura",
  DIBUJO: "Dibujo",
  GRABADO: "Grabado y obra gráfica",
  ILUSTRACION: "Ilustración",
  COLLAGE: "Collage y técnica mixta",
  ESCULTURA: "Escultura",
  CERAMICA: "Cerámica",
  TEXTIL: "Arte textil",
  JOYERIA: "Joyería de autor",
  INSTALACION: "Instalación",
  ARTE_DIGITAL: "Arte digital",
  VIDEOARTE: "Videoarte",
  ARTE_SONORO: "Arte sonoro",
  ARTE_URBANO: "Arte urbano",
  OTRA: "Otra",
};

export type MeasureGroup = "plana" | "volumen" | "tiempo" | "variable" | "libre";

/** Grupo de medidas (spec 6.3). Donde la spec dice "X o Y" va la primera opción. */
export const DISCIPLINE_MEASURE_GROUP: Record<Discipline, MeasureGroup> = {
  FOTOGRAFIA: "plana",
  PINTURA: "plana",
  DIBUJO: "plana",
  GRABADO: "plana",
  ILUSTRACION: "plana",
  COLLAGE: "plana",
  ESCULTURA: "volumen",
  CERAMICA: "volumen",
  TEXTIL: "plana",
  JOYERIA: "volumen",
  INSTALACION: "variable",
  ARTE_DIGITAL: "plana",
  VIDEOARTE: "tiempo",
  ARTE_SONORO: "tiempo",
  ARTE_URBANO: "plana",
  OTRA: "libre",
};

export function isDiscipline(v: unknown): v is Discipline {
  return typeof v === "string" && (DISCIPLINES as readonly string[]).includes(v);
}

const MAX_OTHER_DISCIPLINES = 5;

/** Disciplinas secundarias: únicas, válidas, sin la principal, máximo 5. */
export function parseOtherDisciplines(values: unknown[], primary: Discipline): Discipline[] {
  const out: Discipline[] = [];
  for (const v of values) {
    if (!isDiscipline(v) || v === primary || out.includes(v)) continue;
    out.push(v);
    if (out.length === MAX_OTHER_DISCIPLINES) break;
  }
  return out;
}
