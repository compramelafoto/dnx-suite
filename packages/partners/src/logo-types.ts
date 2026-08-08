import type {
  DnxPartnerAssetBackground,
  DnxPartnerBrandAssetType,
} from "./assets-types";

/** Fondos / tratamientos de archivo por slot de logo. */
export type PartnerLogoSlotBackground = Extract<
  DnxPartnerAssetBackground,
  "COLOR" | "LIGHT" | "DARK"
>;

export type PartnerLogoPreviewKind =
  | "neutral"
  | "dark"
  | "light"
  | "horizontal"
  | "vertical"
  | "isotipo";

export type PartnerLogoSlotGuide = {
  /** Clave estable: `${type}:${backgroundType}` */
  slotKey: string;
  type: DnxPartnerBrandAssetType;
  backgroundType: PartnerLogoSlotBackground;
  title: string;
  shortLabel: string;
  description: string;
  recommendation: string;
  required: boolean;
  previewKind: PartnerLogoPreviewKind;
};

export type PartnerLogoFamilyGuide = {
  id: string;
  type: DnxPartnerBrandAssetType;
  title: string;
  description: string;
  recommendation: string;
  required: boolean;
  previewKind: PartnerLogoPreviewKind;
  slots: readonly PartnerLogoSlotGuide[];
};

function slot(
  type: DnxPartnerBrandAssetType,
  backgroundType: PartnerLogoSlotBackground,
  input: Omit<PartnerLogoSlotGuide, "slotKey" | "type" | "backgroundType">,
): PartnerLogoSlotGuide {
  return {
    slotKey: `${type}:${backgroundType}`,
    type,
    backgroundType,
    ...input,
  };
}

/**
 * Biblioteca de logos: una familia × tres archivos distintos.
 * - Logo general: Color / Negativo / Positivo
 * - Principal, Horizontal, Vertical, Isotipo: Color / Fondo claro / Fondo oscuro
 *
 * Legacy `LOGO_LIGHT` / `LOGO_DARK` siguen en DB pero ya no se ofrecen al subir.
 */
export const PARTNER_LOGO_FAMILIES: readonly PartnerLogoFamilyGuide[] = [
  {
    id: "general",
    type: "LOGO_GENERAL",
    title: "Logo general",
    description:
      "Versión general de la marca. Es la base cuando no hace falta un layout especial (horizontal, vertical o isotipo).",
    recommendation: "Subí un archivo distinto para Color, Negativo y Positivo. PNG o WEBP con transparencia cuando sea posible.",
    required: true,
    previewKind: "neutral",
    slots: [
      slot("LOGO_GENERAL", "COLOR", {
        title: "Color",
        shortLabel: "Color",
        description: "Versión a color de la marca.",
        recommendation: "PNG o WEBP. Ancho recomendado ≥ 1200 px.",
        required: true,
        previewKind: "neutral",
      }),
      slot("LOGO_GENERAL", "DARK", {
        title: "Negativo",
        shortLabel: "Negativo",
        description: "Versión clara/negativa para fondos oscuros.",
        recommendation: "Generalmente blanca o clara. No se genera sola: subí el archivo oficial.",
        required: false,
        previewKind: "dark",
      }),
      slot("LOGO_GENERAL", "LIGHT", {
        title: "Positivo",
        shortLabel: "Positivo",
        description: "Versión oscura/positiva para fondos claros.",
        recommendation: "Generalmente negra u oscura sobre fondo claro.",
        required: false,
        previewKind: "light",
      }),
    ],
  },
  {
    id: "primary",
    type: "LOGO_PRIMARY",
    title: "Logo principal",
    description: "Versión principal de uso habitual en web y piezas digitales.",
    recommendation: "Un archivo por tratamiento: Color, Fondo claro y Fondo oscuro.",
    required: false,
    previewKind: "neutral",
    slots: [
      slot("LOGO_PRIMARY", "COLOR", {
        title: "Color",
        shortLabel: "Color",
        description: "Logo principal a color.",
        recommendation: "PNG o WEBP con transparencia cuando sea posible.",
        required: false,
        previewKind: "neutral",
      }),
      slot("LOGO_PRIMARY", "LIGHT", {
        title: "Fondo claro",
        shortLabel: "Fondo claro",
        description: "Variante pensada para fondos claros.",
        recommendation: "Revisá el preview sobre fondo claro.",
        required: false,
        previewKind: "light",
      }),
      slot("LOGO_PRIMARY", "DARK", {
        title: "Fondo oscuro",
        shortLabel: "Fondo oscuro",
        description: "Variante pensada para fondos oscuros.",
        recommendation: "Revisá el preview sobre fondo oscuro.",
        required: false,
        previewKind: "dark",
      }),
    ],
  },
  {
    id: "horizontal",
    type: "LOGO_HORIZONTAL",
    title: "Logo horizontal",
    description: "Versión apaisada para encabezados, pies y franjas horizontales.",
    recommendation: "Un archivo por tratamiento. Ancho recomendado ≥ 1200 px.",
    required: false,
    previewKind: "horizontal",
    slots: [
      slot("LOGO_HORIZONTAL", "COLOR", {
        title: "Color",
        shortLabel: "Color",
        description: "Logo horizontal a color.",
        recommendation: "Ancho recomendado ≥ 1200 px.",
        required: false,
        previewKind: "horizontal",
      }),
      slot("LOGO_HORIZONTAL", "LIGHT", {
        title: "Fondo claro",
        shortLabel: "Fondo claro",
        description: "Horizontal para fondos claros.",
        recommendation: "PNG o WEBP.",
        required: false,
        previewKind: "light",
      }),
      slot("LOGO_HORIZONTAL", "DARK", {
        title: "Fondo oscuro",
        shortLabel: "Fondo oscuro",
        description: "Horizontal para fondos oscuros.",
        recommendation: "PNG o WEBP.",
        required: false,
        previewKind: "dark",
      }),
    ],
  },
  {
    id: "vertical",
    type: "LOGO_VERTICAL",
    title: "Logo vertical",
    description: "Versión vertical o apilada de la marca.",
    recommendation: "Un archivo por tratamiento. Recomendado ≥ 800 × 800 px.",
    required: false,
    previewKind: "vertical",
    slots: [
      slot("LOGO_VERTICAL", "COLOR", {
        title: "Color",
        shortLabel: "Color",
        description: "Logo vertical a color.",
        recommendation: "Recomendado ≥ 800 × 800 px.",
        required: false,
        previewKind: "vertical",
      }),
      slot("LOGO_VERTICAL", "LIGHT", {
        title: "Fondo claro",
        shortLabel: "Fondo claro",
        description: "Vertical para fondos claros.",
        recommendation: "PNG o WEBP.",
        required: false,
        previewKind: "light",
      }),
      slot("LOGO_VERTICAL", "DARK", {
        title: "Fondo oscuro",
        shortLabel: "Fondo oscuro",
        description: "Vertical para fondos oscuros.",
        recommendation: "PNG o WEBP.",
        required: false,
        previewKind: "dark",
      }),
    ],
  },
  {
    id: "isotipo",
    type: "ISOTYPE",
    title: "Isotipo",
    description: "Solo el símbolo de la marca, sin el nombre.",
    recommendation: "Un archivo por tratamiento. Recomendado ≥ 800 × 800 px.",
    required: false,
    previewKind: "isotipo",
    slots: [
      slot("ISOTYPE", "COLOR", {
        title: "Color",
        shortLabel: "Color",
        description: "Isotipo a color.",
        recommendation: "Fondo transparente preferible.",
        required: false,
        previewKind: "isotipo",
      }),
      slot("ISOTYPE", "LIGHT", {
        title: "Fondo claro",
        shortLabel: "Fondo claro",
        description: "Isotipo para fondos claros.",
        recommendation: "PNG o WEBP.",
        required: false,
        previewKind: "light",
      }),
      slot("ISOTYPE", "DARK", {
        title: "Fondo oscuro",
        shortLabel: "Fondo oscuro",
        description: "Isotipo para fondos oscuros.",
        recommendation: "PNG o WEBP.",
        required: false,
        previewKind: "dark",
      }),
    ],
  },
] as const;

/** Lista plana de slots (15): un upload + preview por cada uno. */
export const PARTNER_LOGO_SLOTS: readonly PartnerLogoSlotGuide[] =
  PARTNER_LOGO_FAMILIES.flatMap((family) => [...family.slots]);

/**
 * @deprecated Preferí `PARTNER_LOGO_FAMILIES` / `PARTNER_LOGO_SLOTS`.
 * Se mantiene como lista de slots para compatibilidad de imports.
 */
export const PARTNER_LOGO_VARIANT_GUIDES = PARTNER_LOGO_SLOTS;

export type PartnerLogoVariantGuide = PartnerLogoSlotGuide;

export const PARTNER_LOGO_ASSET_TYPES: readonly DnxPartnerBrandAssetType[] = [
  "LOGO_GENERAL",
  "LOGO_PRIMARY",
  "LOGO_HORIZONTAL",
  "LOGO_VERTICAL",
  "ISOTYPE",
];

/** Tipos legacy que ya no se suben, pero se leen en resolución. */
export const PARTNER_LOGO_LEGACY_ASSET_TYPES = ["LOGO_LIGHT", "LOGO_DARK"] as const;

export function partnerLogoSlotKey(
  type: DnxPartnerBrandAssetType,
  backgroundType: PartnerLogoSlotBackground,
): string {
  return `${type}:${backgroundType}`;
}

export function isPartnerLogoAssetType(type: string): type is DnxPartnerBrandAssetType {
  return (PARTNER_LOGO_ASSET_TYPES as readonly string[]).includes(type);
}

export function isPartnerLogoSlotBackground(
  value: string,
): value is PartnerLogoSlotBackground {
  return value === "COLOR" || value === "LIGHT" || value === "DARK";
}

export function getPartnerLogoSlotGuide(
  type: DnxPartnerBrandAssetType,
  backgroundType: PartnerLogoSlotBackground,
): PartnerLogoSlotGuide | null {
  return (
    PARTNER_LOGO_SLOTS.find(
      (s) => s.type === type && s.backgroundType === backgroundType,
    ) ?? null
  );
}

export function getPartnerLogoVariantGuide(
  type: DnxPartnerBrandAssetType,
): PartnerLogoSlotGuide | null {
  // Compat: devolver el slot Color de la familia, o el primero.
  return (
    getPartnerLogoSlotGuide(type, "COLOR") ??
    PARTNER_LOGO_SLOTS.find((s) => s.type === type) ??
    null
  );
}

export function getPartnerLogoFamilyGuide(
  type: DnxPartnerBrandAssetType,
): PartnerLogoFamilyGuide | null {
  return PARTNER_LOGO_FAMILIES.find((f) => f.type === type) ?? null;
}
