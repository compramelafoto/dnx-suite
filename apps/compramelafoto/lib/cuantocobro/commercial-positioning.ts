export type CommercialPositioningId =
  | "starting"
  | "growing"
  | "stable"
  | "established"
  | "high-demand";

export type CommercialPositioningOption = {
  id: CommercialPositioningId;
  title: string;
  description: string;
  factor: number;
  isRecommended?: boolean;
};

export const DEFAULT_COMMERCIAL_POSITIONING_ID: CommercialPositioningId = "stable";

export const CC_COMMERCIAL_POSITIONING_INTRO =
  "Además de calcular el valor mínimo para sostener tu negocio, queremos ayudarte a estimar un precio más acorde al momento comercial que estás atravesando. Esta información nunca reducirá tu precio mínimo: solo nos ayuda a sugerir un precio profesional más realista para tu negocio.";

export const CC_COMMERCIAL_POSITIONING_QUESTION =
  "¿Cómo describirías hoy el momento de tu negocio?";

export const COMMERCIAL_POSITIONING_OPTIONS: readonly CommercialPositioningOption[] = [
  {
    id: "starting",
    title: "Estoy comenzando",
    description: "Todavía estoy construyendo mi cartera de clientes y dando mis primeros pasos.",
    factor: 1,
  },
  {
    id: "growing",
    title: "Estoy creciendo",
    description: "Cada vez recibo más consultas y comienzo a tener clientes frecuentes.",
    factor: 1.1,
  },
  {
    id: "stable",
    title: "Tengo un negocio estable",
    description: "Trabajo de forma constante durante gran parte del año.",
    factor: 1.25,
    isRecommended: true,
  },
  {
    id: "established",
    title: "Tengo una marca consolidada",
    description: "Mi trabajo es reconocido y gran parte de mis clientes llegan por recomendación.",
    factor: 1.5,
  },
  {
    id: "high-demand",
    title: "Tengo alta demanda",
    description: "Mi agenda suele completarse con anticipación y con frecuencia debo rechazar trabajos.",
    factor: 2,
  },
] as const;

const OPTION_BY_ID = Object.fromEntries(
  COMMERCIAL_POSITIONING_OPTIONS.map((option) => [option.id, option]),
) as Record<CommercialPositioningId, CommercialPositioningOption>;

export function isCommercialPositioningId(value: string): value is CommercialPositioningId {
  return value in OPTION_BY_ID;
}

export function getEffectiveCommercialPositioningId(
  value: CommercialPositioningId | "" | undefined | null,
): CommercialPositioningId {
  if (value && isCommercialPositioningId(value)) return value;
  return DEFAULT_COMMERCIAL_POSITIONING_ID;
}

export function getCommercialPositioningOption(
  value: CommercialPositioningId | "" | undefined | null,
): CommercialPositioningOption {
  return OPTION_BY_ID[getEffectiveCommercialPositioningId(value)];
}

export function getCommercialPositioningFactor(
  value: CommercialPositioningId | "" | undefined | null,
): number {
  return getCommercialPositioningOption(value).factor;
}

export function roundCuantoCobroPrice(amount: number): number {
  return Math.round(amount);
}

/**
 * Precio mínimo sostenible: resultado del cálculo actual del presupuesto (con márgenes configurados).
 */
export function computeMinimumSustainablePrice(recommendedPrice: number): number {
  return roundCuantoCobroPrice(recommendedPrice);
}

/**
 * Precio recomendado para el negocio según posicionamiento comercial.
 * Nunca puede ser menor al mínimo sostenible.
 */
export function computeRecommendedBusinessPrice(
  minimumSustainablePrice: number,
  positioningId: CommercialPositioningId | "" | undefined | null,
): number {
  const factor = getCommercialPositioningFactor(positioningId);
  const raw = minimumSustainablePrice * factor;
  return roundCuantoCobroPrice(Math.max(minimumSustainablePrice, raw));
}

export const CC_MINIMUM_RECOMMENDED_PRICE_TITLE = "Precio mínimo recomendado";

/** @deprecated Usar CC_MINIMUM_RECOMMENDED_PRICE_TITLE en UI. El cálculo interno sigue siendo minimumSustainablePrice. */
export const CC_MINIMUM_SUSTAINABLE_PRICE_EXPLANATION =
  "Es el valor mínimo que deberías cobrar para cubrir todos tus costos, sostener tu negocio y cumplir los objetivos económicos que configuraste. No recomendamos cobrar por debajo de este importe.";

export const CC_RECOMMENDED_BUSINESS_PRICE_EXPLANATION =
  "Considerando el momento comercial que describiste para tu negocio, este es el valor que te recomendamos presentar a tus clientes.";

export const CC_RESULT_WHY_RECOMMENDED_HIGHER_TITLE = "¿Por qué el precio recomendado es mayor?";

export const CC_RESULT_WHY_RECOMMENDED_HIGHER_TEXT =
  "Porque el mercado no paga solamente tus costos. También paga tu experiencia, tu marca, la confianza que generás, la calidad de tu trabajo, el servicio que brindás y la demanda que tiene tu negocio.\n\nEl precio recomendado representa el valor comercial de todo tu servicio, no únicamente el costo de producirlo.";

export const CC_BEGINNING_POSITIONING_PRICE_NOTE =
  "Como estás comenzando, mantenemos la recomendación en tu precio mínimo recomendado para evitar sugerirte un valor por debajo de lo que tu negocio necesita.";
