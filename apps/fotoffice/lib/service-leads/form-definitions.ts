export const SERVICE_LEAD_EVENT_TYPES = [
  "XV",
  "BODA",
  "SESION_FOTOGRAFICA",
  "EVENTO_RELIGIOSO",
  "SHOW",
  "GRADUACION",
  "INFANTIL",
  "CUMPLEANOS_ADULTO",
  "OTRO_EVENTO",
] as const;

export type ServiceLeadEventType = (typeof SERVICE_LEAD_EVENT_TYPES)[number];

export const SERVICE_LEAD_SUBTYPES = {
  XV: [],
  BODA: [],
  SESION_FOTOGRAFICA: [
    "RETRATO_PERSONAL",
    "BOOK_PROFESIONAL",
    "MARCA_PERSONAL",
    "FAMILIAR",
    "PAREJA",
    "EMBARAZO",
    "NEWBORN",
    "INFANTIL_ESTUDIO",
    "SMASH_CAKE",
    "MODA",
    "PRODUCTO",
    "ARTISTICA_CONCEPTUAL",
    "MASCOTAS",
    "PREBODA",
    "OTRO",
  ],
  EVENTO_RELIGIOSO: ["COMUNION", "CONFIRMACION", "BAUTISMO", "OTRO"],
  SHOW: ["BANDA_RECITAL", "TEATRO", "DANZA", "EVENTO_ARTISTICO", "BACKSTAGE_PRENSA", "OTRO"],
  GRADUACION: ["ACTO", "FIESTA", "AMBOS"],
  INFANTIL: ["CUMPLEANOS", "SESION", "SMASH_CAKE"],
  CUMPLEANOS_ADULTO: [],
  OTRO_EVENTO: [],
} as const satisfies Record<ServiceLeadEventType, readonly string[]>;

export type ServiceLeadEventSubtype<T extends ServiceLeadEventType = ServiceLeadEventType> =
  (typeof SERVICE_LEAD_SUBTYPES)[T][number];

export type ServiceLeadSpecificFieldType = "text" | "date" | "number";

export type ServiceLeadSpecificFieldDefinition = {
  key: string;
  label: string;
  type: ServiceLeadSpecificFieldType;
};

export const SERVICE_LEAD_SPECIFIC_FIELDS = {
  XV: [
    { key: "quinceaneraName", label: "Nombre de la quinceañera", type: "text" },
    { key: "quinceaneraBirthDate", label: "Fecha de nacimiento", type: "date" },
    { key: "salon", label: "Salón", type: "text" },
  ],
  BODA: [
    { key: "noviaName", label: "Nombre de la novia", type: "text" },
    { key: "novioName", label: "Nombre del novio", type: "text" },
    { key: "civilDate", label: "Fecha de civil", type: "date" },
    { key: "ceremonyDate", label: "Fecha de ceremonia", type: "date" },
    { key: "partyDate", label: "Fecha de fiesta", type: "date" },
  ],
  SESION_FOTOGRAFICA: [{ key: "sessionType", label: "Tipo de sesión", type: "text" }],
  EVENTO_RELIGIOSO: [
    { key: "religiousType", label: "Tipo de evento religioso", type: "text" },
    { key: "venue", label: "Lugar", type: "text" },
  ],
  SHOW: [
    { key: "showType", label: "Tipo de show", type: "text" },
    { key: "durationEstimate", label: "Duración estimada", type: "text" },
  ],
  GRADUACION: [
    { key: "graduationType", label: "Tipo de graduación", type: "text" },
    { key: "institution", label: "Institución", type: "text" },
  ],
  INFANTIL: [
    { key: "infantilType", label: "Tipo de cobertura infantil", type: "text" },
    { key: "childAge", label: "Edad del/la niño/a", type: "number" },
  ],
  CUMPLEANOS_ADULTO: [
    { key: "celebrationType", label: "Tipo de festejo", type: "text" },
    { key: "ageApprox", label: "Edad aproximada", type: "number" },
  ],
  OTRO_EVENTO: [],
} as const satisfies Record<ServiceLeadEventType, readonly ServiceLeadSpecificFieldDefinition[]>;

export const SERVICE_LEAD_EVENT_TYPE_LABELS: Record<ServiceLeadEventType, string> = {
  XV: "XV",
  BODA: "Boda",
  SESION_FOTOGRAFICA: "Sesión fotográfica",
  EVENTO_RELIGIOSO: "Evento religioso",
  SHOW: "Show",
  GRADUACION: "Graduación",
  INFANTIL: "Infantil",
  CUMPLEANOS_ADULTO: "Cumpleaños adulto",
  OTRO_EVENTO: "Otro evento",
};

export const SERVICE_LEAD_SUBTYPE_LABELS: Record<string, string> = {
  RETRATO_PERSONAL: "Retrato personal",
  BOOK_PROFESIONAL: "Book profesional",
  MARCA_PERSONAL: "Marca personal",
  FAMILIAR: "Familiar",
  PAREJA: "Pareja",
  EMBARAZO: "Embarazo",
  NEWBORN: "Newborn",
  INFANTIL_ESTUDIO: "Infantil estudio",
  SMASH_CAKE: "Smash cake",
  MODA: "Moda",
  PRODUCTO: "Producto",
  ARTISTICA_CONCEPTUAL: "Artística conceptual",
  MASCOTAS: "Mascotas",
  PREBODA: "Preboda",
  OTRO: "Otro",
  COMUNION: "Comunión",
  CONFIRMACION: "Confirmación",
  BAUTISMO: "Bautismo",
  BANDA_RECITAL: "Banda / recital",
  TEATRO: "Teatro",
  DANZA: "Danza",
  EVENTO_ARTISTICO: "Evento artístico",
  BACKSTAGE_PRENSA: "Backstage / prensa",
  ACTO: "Acto",
  FIESTA: "Fiesta",
  AMBOS: "Ambos",
  CUMPLEANOS: "Cumpleaños",
  SESION: "Sesión",
};

