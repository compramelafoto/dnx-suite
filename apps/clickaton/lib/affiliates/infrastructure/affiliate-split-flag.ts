import { resolveClickatonPaymentsProviderMode } from "@repo/payments/next";

import { isAffiliateSplitEnabled } from "../domain/affiliate-split";

/**
 * El cobro dividido sólo existe en producción (Checkout Pro + Orders) y con
 * `DNX_CLICKATON_AFFILIATE_SPLIT_ENABLED` encendido. Sin base de datos: se
 * puede importar desde cualquier lado.
 */
export function isAffiliateSplitActive(env: NodeJS.ProcessEnv = process.env): boolean {
  if (!isAffiliateSplitEnabled(env)) return false;
  try {
    return (
      resolveClickatonPaymentsProviderMode(
        (env.CLICKATON_DNX_PAYMENTS_PROVIDER ?? "manual").trim(),
        { env },
      ) === "mercado_pago_production"
    );
  } catch {
    return false;
  }
}
