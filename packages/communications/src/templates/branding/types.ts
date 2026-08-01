export const COMMUNICATION_BRAND_IDS = [
  "dnx",
  "compramelafoto",
  "clickaton",
  "fotorank",
  "infospot",
] as const;

export type CommunicationBrandId = (typeof COMMUNICATION_BRAND_IDS)[number];

/**
 * Branding desacoplado de aplicaciones.
 * Sin secretos. URLs opcionales y reemplazables.
 */
export interface CommunicationBrand {
  id: CommunicationBrandId | string;
  displayName: string;
  logoUrl?: string;
  websiteUrl?: string;
  supportEmail?: string;
  primaryColor: string;
  /** Acento secundario (p. ej. violeta Clickatón). */
  accentColor?: string;
  backgroundColor: string;
  surfaceColor: string;
  textColor: string;
  mutedTextColor: string;
  buttonTextColor: string;
  borderColor: string;
  footerText?: string;
}

export type RegisterBrandOptions = {
  replace?: boolean;
};
