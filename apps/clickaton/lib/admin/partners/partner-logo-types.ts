/**
 * Constantes de los logos de partner.
 *
 * Viven fuera de `partner-logo-mutations.ts` porque un módulo `"use server"`
 * sólo puede exportar funciones async.
 */
import type {
  DnxPartnerAssetBackground,
  DnxPartnerBrandAssetType,
} from "@repo/partners";

/**
 * Tipos de logo que se pueden subir desde el panel. Se excluyen documentos y
 * fotos de marca: este formulario es sólo para la identidad visual que entra en
 * placas y piezas públicas.
 */
export const PARTNER_LOGO_UPLOAD_TYPES = [
  "LOGO_GENERAL",
  "LOGO_PRIMARY",
  "LOGO_HORIZONTAL",
  "LOGO_VERTICAL",
  "LOGO_LIGHT",
  "LOGO_DARK",
  "LOGO_MONOCHROME",
  "ISOTYPE",
] as const satisfies readonly DnxPartnerBrandAssetType[];

export type PartnerLogoUploadType = (typeof PARTNER_LOGO_UPLOAD_TYPES)[number];

export const PARTNER_LOGO_TYPE_LABELS: Record<PartnerLogoUploadType, string> = {
  LOGO_GENERAL: "Logo general",
  LOGO_PRIMARY: "Logo principal",
  LOGO_HORIZONTAL: "Logo horizontal",
  LOGO_VERTICAL: "Logo vertical",
  LOGO_LIGHT: "Logo claro (para fondo oscuro)",
  LOGO_DARK: "Logo oscuro (para fondo claro)",
  LOGO_MONOCHROME: "Logo monocromo",
  ISOTYPE: "Isotipo",
};

export const PARTNER_LOGO_BACKGROUND_LABELS: Record<DnxPartnerAssetBackground, string> = {
  TRANSPARENT: "Fondo transparente",
  LIGHT: "Para fondo claro",
  DARK: "Para fondo oscuro",
  COLOR: "Color / cualquiera",
  UNKNOWN: "Sin especificar",
};
