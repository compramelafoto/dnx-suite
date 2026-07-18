import type { QuoteRequiredField } from "../../../quote-request/models.js";

export type DaniCopyKind =
  | "QUESTION"
  | "CONFIRMATION"
  | "READY"
  | "CORRECTION"
  | "INTENT"
  | "VISUAL"
  | "CLARIFICATION";

export type DaniCopyEntry = {
  id: string;
  kind: DaniCopyKind;
  field?: QuoteRequiredField;
  text: string;
};

/** Catálogo centralizado — no dispersar frases por el código. */
export const DANI_COPY_CATALOG: readonly DaniCopyEntry[] = [
  // SERVICE_TYPE
  {
    id: "ASK_SERVICE_TYPE_01",
    kind: "QUESTION",
    field: "SERVICE_TYPE",
    text: "¿Qué tipo de trabajo es?",
  },
  {
    id: "ASK_SERVICE_TYPE_02",
    kind: "QUESTION",
    field: "SERVICE_TYPE",
    text: "Contame un poco qué te pidieron cubrir.",
  },
  {
    id: "ASK_SERVICE_TYPE_03",
    kind: "QUESTION",
    field: "SERVICE_TYPE",
    text: "¿Es un evento, una sesión o algún otro tipo de trabajo?",
  },
  // EVENT_DATE
  {
    id: "ASK_EVENT_DATE_01",
    kind: "QUESTION",
    field: "EVENT_DATE",
    text: "¿Cuándo sería?",
  },
  {
    id: "ASK_EVENT_DATE_02",
    kind: "QUESTION",
    field: "EVENT_DATE",
    text: "¿Ya tenés una fecha?",
  },
  {
    id: "ASK_EVENT_DATE_03",
    kind: "QUESTION",
    field: "EVENT_DATE",
    text: "¿Qué día se hace?",
  },
  // CITY
  {
    id: "ASK_CITY_01",
    kind: "QUESTION",
    field: "CITY",
    text: "¿Dónde sería?",
  },
  {
    id: "ASK_CITY_02",
    kind: "QUESTION",
    field: "CITY",
    text: "¿En qué ciudad lo vas a hacer?",
  },
  {
    id: "ASK_CITY_03",
    kind: "QUESTION",
    field: "CITY",
    text: "¿Dónde es el trabajo?",
  },
  // DURATION_HOURS
  {
    id: "ASK_DURATION_01",
    kind: "QUESTION",
    field: "DURATION_HOURS",
    text: "¿Más o menos cuántas horas pensás cubrir?",
  },
  {
    id: "ASK_DURATION_02",
    kind: "QUESTION",
    field: "DURATION_HOURS",
    text: "¿Cuántas horas de cobertura serían?",
  },
  {
    id: "ASK_DURATION_03",
    kind: "QUESTION",
    field: "DURATION_HOURS",
    text: "¿Va a ser algo corto o una cobertura de varias horas?",
  },
  // Confirmations
  { id: "CONF_BIEN", kind: "CONFIRMATION", text: "Bien." },
  { id: "CONF_DALE", kind: "CONFIRMATION", text: "Dale." },
  { id: "CONF_PERFECTO", kind: "CONFIRMATION", text: "Perfecto." },
  { id: "CONF_BUENISIMO", kind: "CONFIRMATION", text: "Buenísimo." },
  { id: "CONF_ENTIENDO", kind: "CONFIRMATION", text: "Entiendo." },
  { id: "CONF_LISTO", kind: "CONFIRMATION", text: "Listo." },
  // Ready (sin revelar pricing)
  {
    id: "READY_01",
    kind: "READY",
    text: "Bien, con eso ya tengo una buena base para ordenar el trabajo.",
  },
  {
    id: "READY_02",
    kind: "READY",
    text: "Dale, con esos datos ya puedo acomodar el pedido.",
  },
  {
    id: "READY_03",
    kind: "READY",
    text: "Listo, ya tengo lo principal del trabajo.",
  },
  // Corrections
  {
    id: "CORR_DURATION",
    kind: "CORRECTION",
    field: "DURATION_HOURS",
    text: "Dale, entonces son {hours} horas.",
  },
  {
    id: "CORR_CITY",
    kind: "CORRECTION",
    field: "CITY",
    text: "Listo, lo cambio a {city}.",
  },
  {
    id: "CORR_SERVICE",
    kind: "CORRECTION",
    field: "SERVICE_TYPE",
    text: "Dale, lo tomo como {service}.",
  },
  {
    id: "CORR_DATE",
    kind: "CORRECTION",
    field: "EVENT_DATE",
    text: "Listo, actualizo la fecha.",
  },
  {
    id: "CORR_GENERIC",
    kind: "CORRECTION",
    text: "Dale, lo ajusto.",
  },
  // Intent guidance
  {
    id: "INTENT_GREETING",
    kind: "INTENT",
    text: "Hola. Contame en qué te puedo ayudar con el estudio.",
  },
  {
    id: "INTENT_GENERAL",
    kind: "INTENT",
    text: "Bien. Si querés, arrancamos por un presupuesto o por lo que necesites del servicio.",
  },
  {
    id: "INTENT_OUT_OF_SCOPE",
    kind: "INTENT",
    text: "Eso queda un poco afuera de lo que manejo acá. Puedo ayudarte con coberturas y presupuestos de fotografía.",
  },
  {
    id: "INTENT_UNKNOWN",
    kind: "INTENT",
    text: "No te seguí del todo. ¿Buscás un presupuesto, info del servicio, o algo más del estudio?",
  },
  {
    id: "INTENT_ALBUM",
    kind: "INTENT",
    text: "Bien. Esa parte todavía no la estoy haciendo directamente, pero puedo ayudarte a ordenar qué necesitás para publicarlo.",
  },
  {
    id: "INTENT_SELL_PHOTOS",
    kind: "INTENT",
    text: "Entiendo. Por ahora no armo la venta de fotos acá; si querés, podemos ordenar la cobertura o el presupuesto del trabajo.",
  },
  {
    id: "INTENT_THANKS",
    kind: "INTENT",
    text: "De nada. Cualquier otra cosa del trabajo, escribime.",
  },
  {
    id: "INTENT_AFFIRMATIVE",
    kind: "INTENT",
    text: "Dale. Seguimos cuando quieras.",
  },
  {
    id: "INTENT_NEGATIVE",
    kind: "INTENT",
    text: "Entendido. Si más adelante querés retomar, avisame.",
  },
  {
    id: "INTENT_HANDOFF",
    kind: "INTENT",
    text: "Dale, registré que preferís hablar con alguien del estudio. Todavía no derivo la conversación en vivo.",
  },
  {
    id: "INTENT_IMPATIENT",
    kind: "INTENT",
    text: "Te entiendo. Para pasarte un número bien armado necesito algunos datos del trabajo; arranquemos por lo básico.",
  },
  {
    id: "INTENT_DURATION_UNKNOWN",
    kind: "CLARIFICATION",
    text: "Sin drama. Cuando tengas una idea aproximada de horas, la usamos.",
  },
  {
    id: "CANCEL_OK",
    kind: "INTENT",
    text: "Listo, cancelé el presupuesto en curso.",
  },
  // Visual (sin buscar fotos)
  {
    id: "VISUAL_GENERIC",
    kind: "VISUAL",
    text: "Todavía no estoy mostrando fotos dentro de la conversación, pero ya anoté que buscás referencias visuales.",
  },
  {
    id: "VISUAL_NICHE",
    kind: "VISUAL",
    text: "Todavía no estoy mostrando fotos acá, pero ya detecté que buscás referencias de {niche}.",
  },
  {
    id: "VISUAL_NICHE_EMPTY",
    kind: "VISUAL",
    text: "Todavía no tengo referencias autorizadas para mostrarte de {niche}. Cuando carguemos una selección propia, van a aparecer acá.",
  },
  {
    id: "VISUAL_NICHE_WITH_REFS",
    kind: "VISUAL",
    text: "Te muestro algunas referencias de {niche}. Fijate especialmente en {hint}.",
  },
] as const;

/** Overrides in-memory para simulación de calibración (nunca persisten). */
let copyTextOverrides: Map<string, string> | null = null;
let disabledCopyIds: Set<string> | null = null;

export function runWithCopyOverrides<T>(
  options: {
    textOverrides?: Record<string, string>;
    disabledIds?: string[];
  },
  fn: () => T,
): T {
  const prevText = copyTextOverrides;
  const prevDisabled = disabledCopyIds;
  copyTextOverrides = options.textOverrides
    ? new Map(Object.entries(options.textOverrides))
    : null;
  disabledCopyIds = options.disabledIds ? new Set(options.disabledIds) : null;
  try {
    return fn();
  } finally {
    copyTextOverrides = prevText;
    disabledCopyIds = prevDisabled;
  }
}

export async function runWithCopyOverridesAsync<T>(
  options: {
    textOverrides?: Record<string, string>;
    disabledIds?: string[];
  },
  fn: () => Promise<T>,
): Promise<T> {
  const prevText = copyTextOverrides;
  const prevDisabled = disabledCopyIds;
  copyTextOverrides = options.textOverrides
    ? new Map(Object.entries(options.textOverrides))
    : null;
  disabledCopyIds = options.disabledIds ? new Set(options.disabledIds) : null;
  try {
    return await fn();
  } finally {
    copyTextOverrides = prevText;
    disabledCopyIds = prevDisabled;
  }
}

export function getCopyById(id: string): DaniCopyEntry | undefined {
  if (disabledCopyIds?.has(id)) return undefined;
  const entry = DANI_COPY_CATALOG.find((c) => c.id === id);
  if (!entry) return undefined;
  const override = copyTextOverrides?.get(id);
  if (override !== undefined) {
    return { ...entry, text: override };
  }
  return entry;
}

function resolveEntry(entry: DaniCopyEntry): DaniCopyEntry | undefined {
  if (disabledCopyIds?.has(entry.id)) return undefined;
  const override = copyTextOverrides?.get(entry.id);
  return override !== undefined ? { ...entry, text: override } : entry;
}

export function questionCopiesForField(field: QuoteRequiredField): DaniCopyEntry[] {
  return DANI_COPY_CATALOG.filter((c) => c.kind === "QUESTION" && c.field === field)
    .map(resolveEntry)
    .filter((c): c is DaniCopyEntry => c !== undefined);
}

export function confirmationCopies(): DaniCopyEntry[] {
  return DANI_COPY_CATALOG.filter((c) => c.kind === "CONFIRMATION")
    .map(resolveEntry)
    .filter((c): c is DaniCopyEntry => c !== undefined);
}

export function readyCopies(): DaniCopyEntry[] {
  return DANI_COPY_CATALOG.filter((c) => c.kind === "READY")
    .map(resolveEntry)
    .filter((c): c is DaniCopyEntry => c !== undefined);
}
