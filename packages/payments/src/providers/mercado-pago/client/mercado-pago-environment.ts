import type { CurrencyCode } from "../../../contracts/primitives";
import { MercadoPagoProductionWriteBlockedError } from "../../../errors/provider-errors";

export type MercadoPagoEnvironment = "sandbox" | "production";

export interface MercadoPagoProviderConfig {
  environment: MercadoPagoEnvironment;
  accessToken: string;
  publicKey?: string;
  baseUrl: string;
  applicationId?: string;
  integratorId?: string;
  platformId?: string;
  requestTimeoutMs: number;
  maxRetries: number;
  /**
   * When true, HTTP writes are allowed with environment=production.
   * Only Live Checkout Pro adapter should set this; default remains fail-closed.
   */
  allowProductionWrites?: boolean;
}

export const MP_API_BASE_URL = "https://api.mercadopago.com";

/** Decimal scale per currency for MP amount strings. */
export const CURRENCY_DECIMAL_SCALE: Record<CurrencyCode, number> = {
  ARS: 2,
  BRL: 2,
  USD: 2,
  MXN: 2,
  UYU: 2,
  CLP: 0,
};

export function createMercadoPagoProviderConfig(
  partial: Partial<MercadoPagoProviderConfig> & Pick<MercadoPagoProviderConfig, "accessToken">,
): MercadoPagoProviderConfig {
  const environment = partial.environment ?? "sandbox";
  if (environment !== "sandbox" && environment !== "production") {
    throw new Error(`Invalid MercadoPago environment: ${String(partial.environment)}`);
  }
  if (!partial.accessToken || partial.accessToken.trim().length === 0) {
    throw new Error("MercadoPago accessToken is required");
  }
  const requestTimeoutMs = partial.requestTimeoutMs ?? 15_000;
  const maxRetries = partial.maxRetries ?? 3;
  if (requestTimeoutMs < 1_000 || requestTimeoutMs > 120_000) {
    throw new Error("requestTimeoutMs must be between 1000 and 120000");
  }
  if (maxRetries < 0 || maxRetries > 8) {
    throw new Error("maxRetries must be between 0 and 8");
  }
  if (partial.allowProductionWrites && environment !== "production") {
    throw new Error("allowProductionWrites requires environment=production");
  }
  return {
    environment,
    accessToken: partial.accessToken.trim(),
    baseUrl: (partial.baseUrl ?? MP_API_BASE_URL).replace(/\/$/, ""),
    requestTimeoutMs,
    maxRetries,
    ...(partial.allowProductionWrites ? { allowProductionWrites: true } : {}),
    ...(partial.publicKey ? { publicKey: partial.publicKey } : {}),
    ...(partial.applicationId ? { applicationId: partial.applicationId } : {}),
    ...(partial.integratorId ? { integratorId: partial.integratorId } : {}),
    ...(partial.platformId ? { platformId: partial.platformId } : {}),
  };
}

export function isTestAccessToken(token: string): boolean {
  return token.startsWith("TEST-");
}

/**
 * Sandbox-eligible access token shape.
 * Mercado Pago MLA "Credenciales de prueba" often issue `APP_USR-` (not only legacy `TEST-`).
 * Production writes remain blocked by `environment === "production"` + confirm gates.
 */
export function isSandboxAccessToken(token: string): boolean {
  const t = token.trim();
  return t.startsWith("TEST-") || t.startsWith("APP_USR-");
}

export function assertSandboxWriteAllowed(config: MercadoPagoProviderConfig): void {
  if (config.environment === "production") {
    throw new MercadoPagoProductionWriteBlockedError();
  }
}

export function assertSandboxToken(config: MercadoPagoProviderConfig): void {
  if (config.environment !== "sandbox") {
    throw new MercadoPagoProductionWriteBlockedError(
      "Mercado Pago write operations require sandbox environment",
    );
  }
  if (!isSandboxAccessToken(config.accessToken)) {
    throw new MercadoPagoProductionWriteBlockedError(
      "Mercado Pago sandbox writes require a TEST- or APP_USR- access token from Credenciales de prueba",
    );
  }
}

export function getCurrencyScale(currency: CurrencyCode): number {
  const scale = CURRENCY_DECIMAL_SCALE[currency];
  if (scale === undefined) {
    throw new Error(`Unknown currency scale for ${currency}`);
  }
  return scale;
}
