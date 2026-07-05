/**
 * Catálogo pedagógico de objetivos — Cam Of Duty.
 */

export type LensType = "PRIME" | "ZOOM";

export type LensUseCase =
  | "paisaje"
  | "retrato"
  | "deporte"
  | "eventos"
  | "producto"
  | "social"
  | "documental"
  | "arquitectura"
  | "macro"
  | "fauna";

export interface SimulatorLensDefinition {
  id: string;
  name: string;
  type: LensType;
  minFocalLengthMm: number;
  maxFocalLengthMm: number;
  defaultFocalLengthMm: number;
  maxApertureWide: number;
  maxApertureTele: number;
  minAperture: number;
  description: string;
  recommendedUses: LensUseCase[];
}

/** Estado activo del objetivo montado (sincronizado con store y runtime). */
export interface ActiveLensState {
  lensId: string;
  lensName: string;
  lensType: LensType;
  focalLengthMm: number;
  minFocalLengthMm: number;
  maxFocalLengthMm: number;
  maxApertureWide: number;
  maxApertureTele: number;
  /** Apertura máxima (más abierta) a la focal actual. */
  maxAperture: number;
  minAperture: number;
  isZoomLens: boolean;
}

export const DEFAULT_LENS_ID = "50f18";

export const SIMULATOR_LENSES: SimulatorLensDefinition[] = [
  {
    id: "14f28",
    name: "14mm f/2.8",
    type: "PRIME",
    minFocalLengthMm: 14,
    maxFocalLengthMm: 14,
    defaultFocalLengthMm: 14,
    maxApertureWide: 2.8,
    maxApertureTele: 2.8,
    minAperture: 22,
    description: "Gran angular extremo para paisajes amplios y arquitectura interior.",
    recommendedUses: ["paisaje", "arquitectura", "documental"],
  },
  {
    id: "20f18",
    name: "20mm f/1.8",
    type: "PRIME",
    minFocalLengthMm: 20,
    maxFocalLengthMm: 20,
    defaultFocalLengthMm: 20,
    maxApertureWide: 1.8,
    maxApertureTele: 1.8,
    minAperture: 22,
    description: "Angular luminoso para escenas amplias con poca luz.",
    recommendedUses: ["paisaje", "arquitectura", "social"],
  },
  {
    id: "24f18",
    name: "24mm f/1.8",
    type: "PRIME",
    minFocalLengthMm: 24,
    maxFocalLengthMm: 24,
    defaultFocalLengthMm: 24,
    maxApertureWide: 1.8,
    maxApertureTele: 1.8,
    minAperture: 22,
    description: "Gran angular versátil para reportaje y paisaje urbano.",
    recommendedUses: ["paisaje", "documental", "arquitectura"],
  },
  {
    id: "28f2",
    name: "28mm f/2",
    type: "PRIME",
    minFocalLengthMm: 28,
    maxFocalLengthMm: 28,
    defaultFocalLengthMm: 28,
    maxApertureWide: 2,
    maxApertureTele: 2,
    minAperture: 22,
    description: "Angular clásico con buen equilibrio de encuadre y profundidad.",
    recommendedUses: ["documental", "social", "paisaje"],
  },
  {
    id: "35f18",
    name: "35mm f/1.8",
    type: "PRIME",
    minFocalLengthMm: 35,
    maxFocalLengthMm: 35,
    defaultFocalLengthMm: 35,
    maxApertureWide: 1.8,
    maxApertureTele: 1.8,
    minAperture: 22,
    description: "Encuadre natural para calle, eventos y retrato ambiental.",
    recommendedUses: ["documental", "social", "retrato"],
  },
  {
    id: "50f18",
    name: "50mm f/1.8",
    type: "PRIME",
    minFocalLengthMm: 50,
    maxFocalLengthMm: 50,
    defaultFocalLengthMm: 50,
    maxApertureWide: 1.8,
    maxApertureTele: 1.8,
    minAperture: 22,
    description: "Normal clásico; ideal para aprender exposición y profundidad de campo.",
    recommendedUses: ["retrato", "social", "documental"],
  },
  {
    id: "85f18",
    name: "85mm f/1.8",
    type: "PRIME",
    minFocalLengthMm: 85,
    maxFocalLengthMm: 85,
    defaultFocalLengthMm: 85,
    maxApertureWide: 1.8,
    maxApertureTele: 1.8,
    minAperture: 22,
    description: "Tele corto de retrato con desenfoque de fondo marcado.",
    recommendedUses: ["retrato", "eventos", "producto"],
  },
  {
    id: "100macro28",
    name: "100mm macro f/2.8",
    type: "PRIME",
    minFocalLengthMm: 100,
    maxFocalLengthMm: 100,
    defaultFocalLengthMm: 100,
    maxApertureWide: 2.8,
    maxApertureTele: 2.8,
    minAperture: 32,
    description: "Macro/retrato detalle con plano de enfoque muy reducido.",
    recommendedUses: ["macro", "producto", "retrato"],
  },
  {
    id: "135f18",
    name: "135mm f/1.8",
    type: "PRIME",
    minFocalLengthMm: 135,
    maxFocalLengthMm: 135,
    defaultFocalLengthMm: 135,
    maxApertureWide: 1.8,
    maxApertureTele: 1.8,
    minAperture: 22,
    description: "Tele medio para retrato y compresión de perspectiva.",
    recommendedUses: ["retrato", "deporte", "eventos"],
  },
  {
    id: "200f28",
    name: "200mm f/2.8",
    type: "PRIME",
    minFocalLengthMm: 200,
    maxFocalLengthMm: 200,
    defaultFocalLengthMm: 200,
    maxApertureWide: 2.8,
    maxApertureTele: 2.8,
    minAperture: 32,
    description: "Tele largo para deporte, fauna y sujetos lejanos.",
    recommendedUses: ["deporte", "fauna", "eventos"],
  },
  {
    id: "1635f28",
    name: "16-35mm f/2.8",
    type: "ZOOM",
    minFocalLengthMm: 16,
    maxFocalLengthMm: 35,
    defaultFocalLengthMm: 24,
    maxApertureWide: 2.8,
    maxApertureTele: 2.8,
    minAperture: 22,
    description: "Zoom angular profesional para paisaje y arquitectura.",
    recommendedUses: ["paisaje", "arquitectura", "eventos"],
  },
  {
    id: "2470f28",
    name: "24-70mm f/2.8",
    type: "ZOOM",
    minFocalLengthMm: 24,
    maxFocalLengthMm: 70,
    defaultFocalLengthMm: 50,
    maxApertureWide: 2.8,
    maxApertureTele: 2.8,
    minAperture: 22,
    description: "Zoom estándar todo-en-uno para eventos y documental.",
    recommendedUses: ["eventos", "social", "documental"],
  },
  {
    id: "24105f4",
    name: "24-105mm f/4",
    type: "ZOOM",
    minFocalLengthMm: 24,
    maxFocalLengthMm: 105,
    defaultFocalLengthMm: 50,
    maxApertureWide: 4,
    maxApertureTele: 4,
    minAperture: 22,
    description: "Zoom versátil con apertura constante f/4.",
    recommendedUses: ["eventos", "documental", "retrato"],
  },
  {
    id: "70200f28",
    name: "70-200mm f/2.8",
    type: "ZOOM",
    minFocalLengthMm: 70,
    maxFocalLengthMm: 200,
    defaultFocalLengthMm: 135,
    maxApertureWide: 2.8,
    maxApertureTele: 2.8,
    minAperture: 32,
    description: "Tele zoom clásico de deporte y retrato.",
    recommendedUses: ["deporte", "retrato", "eventos"],
  },
  {
    id: "70300f456",
    name: "70-300mm f/4.5-5.6",
    type: "ZOOM",
    minFocalLengthMm: 70,
    maxFocalLengthMm: 300,
    defaultFocalLengthMm: 200,
    maxApertureWide: 4.5,
    maxApertureTele: 5.6,
    minAperture: 32,
    description: "Tele económico con apertura variable al hacer zoom.",
    recommendedUses: ["deporte", "fauna", "eventos"],
  },
  {
    id: "100400f456",
    name: "100-400mm f/4.5-5.6",
    type: "ZOOM",
    minFocalLengthMm: 100,
    maxFocalLengthMm: 400,
    defaultFocalLengthMm: 200,
    maxApertureWide: 4.5,
    maxApertureTele: 5.6,
    minAperture: 32,
    description: "Supertele zoom para fauna y deporte a distancia.",
    recommendedUses: ["fauna", "deporte", "eventos"],
  },
  {
    id: "1855f3556",
    name: "18-55mm f/3.5-5.6",
    type: "ZOOM",
    minFocalLengthMm: 18,
    maxFocalLengthMm: 55,
    defaultFocalLengthMm: 35,
    maxApertureWide: 3.5,
    maxApertureTele: 5.6,
    minAperture: 22,
    description: "Kit zoom de entrada; aprende encuadre y zoom.",
    recommendedUses: ["social", "documental", "paisaje"],
  },
  {
    id: "18105f4",
    name: "18-105mm f/4",
    type: "ZOOM",
    minFocalLengthMm: 18,
    maxFocalLengthMm: 105,
    defaultFocalLengthMm: 50,
    maxApertureWide: 4,
    maxApertureTele: 4,
    minAperture: 22,
    description: "Zoom de viaje con rango amplio y f/4 constante.",
    recommendedUses: ["documental", "eventos", "social"],
  },
  {
    id: "18200f3563",
    name: "18-200mm f/3.5-6.3",
    type: "ZOOM",
    minFocalLengthMm: 18,
    maxFocalLengthMm: 200,
    defaultFocalLengthMm: 50,
    maxApertureWide: 3.5,
    maxApertureTele: 6.3,
    minAperture: 32,
    description: "Superzoom todo-en-uno; práctico pero con compromisos ópticos.",
    recommendedUses: ["documental", "eventos", "paisaje"],
  },
];

const LENS_BY_ID = new Map(SIMULATOR_LENSES.map((l) => [l.id, l]));

export function getLensById(id: string): SimulatorLensDefinition | undefined {
  return LENS_BY_ID.get(id);
}

export function getDefaultLens(): SimulatorLensDefinition {
  return LENS_BY_ID.get(DEFAULT_LENS_ID) ?? SIMULATOR_LENSES[5];
}

/** Apertura máxima (más abierta) según focal en zooms con diafragma variable. */
export function getMaxApertureAtFocal(
  lens: Pick<
    SimulatorLensDefinition,
    "minFocalLengthMm" | "maxFocalLengthMm" | "maxApertureWide" | "maxApertureTele"
  >,
  focalLengthMm: number,
): number {
  if (lens.minFocalLengthMm === lens.maxFocalLengthMm) {
    return lens.maxApertureWide;
  }
  const t =
    (focalLengthMm - lens.minFocalLengthMm) /
    Math.max(1, lens.maxFocalLengthMm - lens.minFocalLengthMm);
  const clamped = Math.min(1, Math.max(0, t));
  return lens.maxApertureWide + (lens.maxApertureTele - lens.maxApertureWide) * clamped;
}

export function definitionToActiveState(
  def: SimulatorLensDefinition,
  focalLengthMm = def.defaultFocalLengthMm,
): ActiveLensState {
  const focal = clampFocal(def, focalLengthMm);
  return {
    lensId: def.id,
    lensName: def.name,
    lensType: def.type,
    focalLengthMm: focal,
    minFocalLengthMm: def.minFocalLengthMm,
    maxFocalLengthMm: def.maxFocalLengthMm,
    maxApertureWide: def.maxApertureWide,
    maxApertureTele: def.maxApertureTele,
    maxAperture: getMaxApertureAtFocal(def, focal),
    minAperture: def.minAperture,
    isZoomLens: def.type === "ZOOM",
  };
}

export function clampFocal(
  lens: Pick<SimulatorLensDefinition, "minFocalLengthMm" | "maxFocalLengthMm">,
  focalLengthMm: number,
): number {
  return Math.round(
    Math.min(lens.maxFocalLengthMm, Math.max(lens.minFocalLengthMm, focalLengthMm)),
  );
}

export function stepLensFocal(active: ActiveLensState, delta: -1 | 1): number {
  if (!active.isZoomLens) return active.focalLengthMm;
  const range = active.maxFocalLengthMm - active.minFocalLengthMm;
  const step = Math.max(1, Math.round(range / 24));
  return clampFocal(active, active.focalLengthMm + delta * step);
}

export function formatLensUseCases(uses: LensUseCase[]): string {
  return uses.join(" · ");
}

export function formatLensCardSubtitle(def: SimulatorLensDefinition): string {
  const typeLabel = def.type === "PRIME" ? "Fija" : "Zoom";
  return `${typeLabel} · ${formatLensUseCases(def.recommendedUses)}`;
}

export function formatLensFocalRange(def: SimulatorLensDefinition): string {
  if (def.type === "PRIME") return `${def.minFocalLengthMm}mm`;
  return `${def.minFocalLengthMm}–${def.maxFocalLengthMm}mm`;
}

export function formatLensMaxApertureLabel(def: SimulatorLensDefinition): string {
  if (def.maxApertureWide === def.maxApertureTele) {
    return `f/${def.maxApertureWide}`;
  }
  return `f/${def.maxApertureWide}–${def.maxApertureTele}`;
}

export function formatHudFocal(active: ActiveLensState): string {
  if (!active.isZoomLens) return `${active.focalLengthMm}mm`;
  return `${active.minFocalLengthMm}–${active.maxFocalLengthMm}mm @ ${active.focalLengthMm}mm`;
}
