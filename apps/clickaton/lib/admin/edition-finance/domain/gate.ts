import type {
  CommercialFinanceGateResult,
  EditionFinancialDistributionView,
} from "./types";

export type GateMode = "TEST" | "LIVE";

/**
 * Gate comercial para habilitar registrationEnabled / cobros.
 * TEST: permite conexiones TEST activas.
 * LIVE: exige conexiones LIVE activas + distribución ACTIVE.
 */
export function evaluateCommercialFinanceGate(input: {
  mode: GateMode;
  distribution: EditionFinancialDistributionView | null;
  dnxPaymentsReady?: boolean;
  webhookConfigured?: boolean;
  hasActivePricePhase?: boolean;
}): CommercialFinanceGateResult {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const dist = input.distribution;

  if (!dist) {
    blockers.push("No hay distribución financiera ACTIVE para la edición.");
  } else if (dist.status !== "ACTIVE") {
    blockers.push(`La distribución vigente está en estado ${dist.status}, se requiere ACTIVE.`);
  } else {
    const sum = dist.allocations.reduce((s, a) => s + a.shareBps, 0);
    if (sum !== 10_000) {
      blockers.push(`La suma de allocations no es 100% (bps=${sum}).`);
    }
    for (const a of dist.allocations) {
      if (!a.paymentConnectionId || !a.paymentConnection) {
        blockers.push(
          `Beneficiario ${a.beneficiaryDisplayName} sin conexión Mercado Pago.`,
        );
        continue;
      }
      const conn = a.paymentConnection;
      if (!conn.canReceivePayments) {
        blockers.push(
          `Conexión de ${a.beneficiaryDisplayName} no puede recibir pagos (${conn.status}).`,
        );
      }
      const env = String(conn.environment).toUpperCase();
      const isLiveEnv = env === "LIVE" || env === "PROD" || env === "PRODUCTION";
      if (input.mode === "LIVE" && !isLiveEnv) {
        blockers.push(
          `Conexión de ${a.beneficiaryDisplayName} está en ${conn.environment}; se requiere LIVE/PROD.`,
        );
      }
      if (input.mode === "TEST" && isLiveEnv) {
        warnings.push(
          `Conexión LIVE/PROD de ${a.beneficiaryDisplayName} usada en modo TEST.`,
        );
      }
      if (conn.lastError) {
        warnings.push(
          `Último error de conexión (${a.beneficiaryDisplayName}): ${conn.lastError}`,
        );
      }
    }
  }

  if (input.hasActivePricePhase === false) {
    blockers.push("No hay fase de precio vigente/configurada.");
  }
  if (input.dnxPaymentsReady === false) {
    blockers.push("DNX Payments no está operativo.");
  }
  if (input.mode === "LIVE" && input.webhookConfigured === false) {
    blockers.push("Webhook LIVE de Mercado Pago / DNX Payments no configurado.");
  }

  return {
    ok: blockers.length === 0,
    mode: input.mode,
    blockers,
    warnings,
    distribution: dist,
  };
}
