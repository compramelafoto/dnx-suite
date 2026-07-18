export const EDUCATIONAL_PURPOSES = [
  "composición",
  "iluminación",
  "uso del fondo",
  "anticipación del momento",
  "narrativa",
  "interacción con personas",
  "congelamiento de acción",
  "barrido",
  "profundidad de campo",
  "fotografía espontánea",
  "fotografía posada",
  "cobertura documental",
  "detalle",
  "contexto",
  "venta potencial",
  "selección editorial",
] as const;

export type EducationalPurpose = (typeof EDUCATIONAL_PURPOSES)[number];

export function isEducationalPurpose(value: string): value is EducationalPurpose {
  return (EDUCATIONAL_PURPOSES as readonly string[]).includes(value);
}
