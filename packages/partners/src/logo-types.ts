import type { DnxPartnerBrandAssetType } from "./assets-types";

/** Variantes de logo con copy educativo (admin + onboarding público). */
export const PARTNER_LOGO_VARIANT_GUIDES = [
  {
    type: "LOGO_PRIMARY" as const,
    required: true,
    title: "Logo principal",
    shortLabel: "Principal",
    description:
      "Es la versión principal de tu marca. Usaremos este logo cuando no necesitemos una variante especial.",
    recommendation: "PNG o WEBP con fondo transparente cuando sea posible. Ancho recomendado ≥ 1200 px.",
    previewKind: "neutral" as const,
  },
  {
    type: "LOGO_LIGHT" as const,
    required: false,
    title: "Logo claro",
    shortLabel: "Claro",
    description:
      "Esta versión debe verse correctamente sobre fondos oscuros. Generalmente el texto y los elementos del logo son blancos o claros.",
    recommendation: "Subí la versión oficial clara de tu marca. No generamos esta variante automáticamente.",
    previewKind: "dark" as const,
  },
  {
    type: "LOGO_DARK" as const,
    required: false,
    title: "Logo oscuro",
    shortLabel: "Oscuro",
    description:
      "Esta versión está pensada para fondos claros. Generalmente utiliza los colores originales o una versión negra/oscura.",
    recommendation: "PNG o WEBP. Revisá el preview sobre fondo claro antes de enviar.",
    previewKind: "light" as const,
  },
  {
    type: "LOGO_HORIZONTAL" as const,
    required: false,
    title: "Logo horizontal",
    shortLabel: "Horizontal",
    description:
      "Versión apaisada de tu marca. Es útil para encabezados, pies de página y espacios horizontales.",
    recommendation: "Ancho recomendado ≥ 1200 px.",
    previewKind: "horizontal" as const,
  },
  {
    type: "LOGO_VERTICAL" as const,
    required: false,
    title: "Logo vertical",
    shortLabel: "Vertical",
    description: "Versión vertical o apilada de tu marca.",
    recommendation: "Recomendado ≥ 800 × 800 px o superior.",
    previewKind: "vertical" as const,
  },
  {
    type: "ISOTYPE" as const,
    required: false,
    title: "Isotipo",
    shortLabel: "Isotipo",
    description: "Es únicamente el símbolo de tu marca, sin el nombre de la empresa.",
    recommendation: "Recomendado ≥ 800 × 800 px. Fondo transparente preferible.",
    previewKind: "isotipo" as const,
  },
] as const;

export type PartnerLogoVariantGuide = (typeof PARTNER_LOGO_VARIANT_GUIDES)[number];

export const PARTNER_LOGO_ASSET_TYPES: readonly DnxPartnerBrandAssetType[] =
  PARTNER_LOGO_VARIANT_GUIDES.map((g) => g.type);

export function isPartnerLogoAssetType(type: string): type is DnxPartnerBrandAssetType {
  return (PARTNER_LOGO_ASSET_TYPES as readonly string[]).includes(type);
}

export function getPartnerLogoVariantGuide(
  type: DnxPartnerBrandAssetType,
): PartnerLogoVariantGuide | null {
  return PARTNER_LOGO_VARIANT_GUIDES.find((g) => g.type === type) ?? null;
}
