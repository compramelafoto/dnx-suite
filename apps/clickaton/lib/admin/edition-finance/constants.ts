/** Product key canónico DNX Payments para Clickatón. */
export const CLICKATON_PRODUCT_KEY = "clickaton";

/** Scope de acuerdo económico por edición. */
export const EDITION_SCOPE_TYPE = "EDITION";

/** 100% en basis points. */
export const PERCENTAGE_BPS_TOTAL = 10_000;

/** Política de redondeo determinística (alineada a DnxDistributionVersion). */
export const DEFAULT_ROUNDING_POLICY = "LARGEST_REMAINDER" as const;

/**
 * Fee policy para AR 2026:
 * Tammy recibe 100% del importe distribuible después de comisiones inevitables del PSP.
 * Sin platformFee DNX/Clickatón adicional en esta edición.
 */
export const ARGENTINA_2026_FEE_POLICY =
  "DISTRIBUTABLE_AFTER_PROVIDER_FEE;PLATFORM_FEE=0;TAMMY_SHARE=100%" as const;

/**
 * Emails canónicos de seed / UX (no otorgan permisos por sí solos).
 * Permisos finance = `DnxFinanceGrant` explícitos.
 *
 * 10D.2.2F: finance owner administrativo = cuart.daniel@gmail.com
 * (dnxfotografia queda VIEWER + PARTNER_CONNECT, no OWNER).
 */
export const FINANCE_SEED_EMAILS = {
  daniel: "cuart.daniel@gmail.com",
  rodri: "rodrigorincon40@gmail.com",
  tammy: "tammyytamer@gmail.com",
  /** Operativo Clickatón — partner/viewer, no finance owner. */
  dnxStudio: "dnxfotografia@gmail.com",
} as const;
