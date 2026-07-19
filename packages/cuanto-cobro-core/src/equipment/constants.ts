import type { EquipmentRenewalCategoryId, FutureEquipmentCategoryId } from "./types";

export const EQUIPMENT_PURPOSE = {
  RENEWAL: "RENEWAL_CURRENT_EQUIPMENT",
  EXPANSION: "FUTURE_EXPANSION_EQUIPMENT",
} as const;

export const DEFAULT_CAMERA_SHUTTER_RATING = 300_000;
export const DEFAULT_LENS_LIFESPAN_YEARS = 10;
export const DEFAULT_COMPUTER_LIFESPAN_YEARS = 5;
export const DEFAULT_MONITOR_LIFESPAN_YEARS = 8;
export const DEFAULT_SPEEDLIGHT_LIFESPAN_YEARS = 5;
export const DEFAULT_STUDIO_FLASH_LIFESPAN_YEARS = 8;
export const MEMORY_CARD_REPLACEMENT_MONTHS = 6;
export const DEFAULT_STORAGE_AMORTIZATION_YEARS = 5;
export const PHOTO_RETENTION_RATIO = 0.5;
export const AVERAGE_STORED_PHOTO_MB = 20;
export const AA_BATTERIES_PER_SPEEDLIGHT = 4;

export const RENEWAL_CATEGORY_META: Record<
  EquipmentRenewalCategoryId,
  { title: string; shortTitle: string; description: string }
> = {
  camera: {
    title: "Cámara",
    shortTitle: "Cámara",
    description: "Modelo, valor de reposición y disparos. El ahorro se calcula según la vida útil del obturador.",
  },
  lenses: {
    title: "Lentes",
    shortTitle: "Lentes",
    description: "Los lentes que ya tenés. Vida útil sugerida: 10 años por unidad.",
  },
  "memory-cards": {
    title: "Tarjetas de memoria",
    shortTitle: "Tarjetas",
    description: "Cantidad actual y precio promedio. Sugerimos renovar 1 tarjeta cada 6 meses.",
  },
  computer: {
    title: "Computadora",
    shortTitle: "Computadora",
    description: "Tu equipo de edición. Renovación sugerida cada 5 años.",
  },
  monitor: {
    title: "Monitor",
    shortTitle: "Monitor",
    description: "Monitor de edición. Vida útil sugerida: 8 años.",
  },
  "storage-disks": {
    title: "Discos de almacenamiento",
    shortTitle: "Discos",
    description: "Capacidad actual y precio estimado de reposición.",
  },
  speedlight: {
    title: "Flash de cámara / Speedlight",
    shortTitle: "Speedlight",
    description: "Flashes portátiles que ya tenés.",
  },
  "studio-flash": {
    title: "Flash de estudio",
    shortTitle: "Flash estudio",
    description: "Luces de estudio que ya tenés.",
  },
  "aa-batteries": {
    title: "Pilas AA para flashes",
    shortTitle: "Pilas AA",
    description: "Solo si tus speedlights usan pilas AA (4 por unidad).",
  },
};

export const FUTURE_CATEGORY_LABELS: Record<FutureEquipmentCategoryId, string> = {
  camera: "Cámara adicional",
  lenses: "Lente",
  "memory-cards": "Tarjetas de memoria",
  computer: "Computadora",
  monitor: "Monitor",
  "storage-disks": "Discos de almacenamiento",
  speedlight: "Flash de cámara / Speedlight",
  "studio-flash": "Flash de estudio",
  "aa-batteries": "Pilas AA",
  drone: "Drone",
  other: "Otro equipo",
};

export const FUTURE_TIMELINE_OPTIONS: Array<{ value: "" | "1" | "2" | "3" | "none"; label: string }> = [
  { value: "", label: "Seleccioná un plazo" },
  { value: "1", label: "1 año" },
  { value: "2", label: "2 años" },
  { value: "3", label: "3 años" },
  { value: "none", label: "Sin fecha definida" },
];

export const CC_EQUIPMENT_RENEWAL_INTRO =
  "Registrá el equipo que ya usás. Calculamos cuánto ahorrar por mes para renovarlo sin afectar tu negocio.";

export const CC_EQUIPMENT_RENEWAL_HELP =
  "Solo equipamiento que ya forma parte de tu negocio. Para sumar herramientas nuevas, usá la sección «Equipos que deseo comprar».";

export const CC_EQUIPMENT_EXPANSION_INTRO =
  "Equipos que querés comprar para crecer: segunda cámara, lente, drone, monitor extra, etc.";

export const CC_EQUIPMENT_EXPANSION_HELP =
  "Estos equipos amplían tu capacidad; no reemplazan lo que ya tenés. Si es un reemplazo, cargalo en «Renovación de mi equipamiento».";

export const CC_EQUIPMENT_CAMERA_EXPANSION_HINT =
  "Cámara adicional, no reemplazo. Si querés renovar la actual, configurá «Renovación» → Cámara.";

export const CC_EQUIPMENT_DUPLICATE_CAMERA_HINT =
  "¿Reemplazo o cámara extra? Si es reemplazo, usá Renovación → Cámara. Si es adicional, dejala aquí.";
