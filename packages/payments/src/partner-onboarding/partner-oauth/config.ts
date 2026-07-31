/**
 * Partner / recipient Mercado Pago self-connect (10D.2.1).
 * Reuses Clickatón MP OAuth app + vault. Never mutates owner ORGANIZATION collector.
 */

import { isTruthyFlag } from "../owner-oauth/config.js";
import type { FinancialEnvironment } from "../../financial-identity/types.js";

export const PARTNER_SELF_CONNECT_FLAG =
  "DNX_PARTNER_MP_SELF_CONNECT_ENABLED" as const;

export const PARTNER_OAUTH_ENVIRONMENT_ENV =
  "DNX_PARTNER_MP_OAUTH_ENVIRONMENT" as const;

export const PARTNER_MP_ORIGIN_APP = "dnx_partner" as const;
export const PARTNER_MP_EXTERNAL_REF = "accountType=PARTNER" as const;
export const PARTNER_MP_VAULT_ORIGIN = "clickaton_partner_oauth" as const;

export const PARTNER_OAUTH_PATHS = {
  connect: "/api/dnx-payments/partner/mercadopago/connect",
  reconnect: "/api/dnx-payments/partner/mercadopago/reconnect",
  revoke: "/api/dnx-payments/partner/mercadopago/revoke",
  /** Same MP redirect as owner — branched by OAuth state purpose. */
  callback: "/api/clickaton/payments/mercadopago/callback",
  panel: "/admin/finanzas/mi-cuenta",
} as const;

export const PARTNER_OAUTH_PURPOSES = {
  connection: "PARTNER_CONNECTION",
  reconnect: "PARTNER_RECONNECT",
} as const;

export type PartnerOAuthPurpose =
  (typeof PARTNER_OAUTH_PURPOSES)[keyof typeof PARTNER_OAUTH_PURPOSES];

export function isPartnerOAuthPurpose(value: string): value is PartnerOAuthPurpose {
  return (
    value === PARTNER_OAUTH_PURPOSES.connection ||
    value === PARTNER_OAUTH_PURPOSES.reconnect
  );
}

export function isPartnerSelfConnectEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return isTruthyFlag(env[PARTNER_SELF_CONNECT_FLAG]);
}

/**
 * TEST for Staging/Sandbox; PROD for Production LIVE.
 * Explicit env wins; else infer from APP_URL / staging host.
 */
export function resolvePartnerOAuthEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): FinancialEnvironment {
  const explicit = (env[PARTNER_OAUTH_ENVIRONMENT_ENV] ?? "").trim().toUpperCase();
  if (explicit === "TEST" || explicit === "PROD") return explicit;

  const appUrl = (
    env.APP_URL ||
    env.CLICKATON_PUBLIC_URL ||
    env.NEXT_PUBLIC_APP_URL ||
    ""
  ).toLowerCase();
  if (
    appUrl.includes("staging") ||
    appUrl.includes("localhost") ||
    appUrl.includes("127.0.0.1")
  ) {
    return "TEST";
  }
  return "PROD";
}
