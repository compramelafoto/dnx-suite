/**
 * Extracción honesta de comisión Mercado Pago desde el cuerpo de pago.
 * No inventa fees: si no hay datos confiables, confirmed = null.
 */

export type MercadoPagoFeeExtraction = {
  providerFeeConfirmedMinor: number | null;
  netReceivedMinor: number | null;
  source: "fee_details" | "net_received" | "unknown";
};

function unitToMinor(amount: number, currency: string): number {
  if (currency === "CLP") return Math.round(amount);
  return Math.round(amount * 100);
}

export function extractProviderFeeMinorFromMpPayment(
  raw: Record<string, unknown>,
  currency = "ARS",
): MercadoPagoFeeExtraction {
  const feeDetails = Array.isArray(raw.fee_details) ? raw.fee_details : null;
  if (feeDetails && feeDetails.length > 0) {
    let sum = 0;
    let found = false;
    for (const row of feeDetails) {
      if (typeof row !== "object" || row === null) continue;
      const amount = (row as { amount?: unknown }).amount;
      if (typeof amount === "number" && Number.isFinite(amount)) {
        sum += unitToMinor(amount, currency);
        found = true;
      }
    }
    if (found) {
      return {
        providerFeeConfirmedMinor: sum,
        netReceivedMinor: null,
        source: "fee_details",
      };
    }
  }

  const details =
    typeof raw.transaction_details === "object" && raw.transaction_details !== null
      ? (raw.transaction_details as Record<string, unknown>)
      : null;
  const net = details?.net_received_amount;
  const charged =
    typeof raw.transaction_amount === "number" ? raw.transaction_amount : null;
  if (typeof net === "number" && typeof charged === "number") {
    const feeUnit = charged - net;
    if (feeUnit >= 0) {
      return {
        providerFeeConfirmedMinor: unitToMinor(feeUnit, currency),
        netReceivedMinor: unitToMinor(net, currency),
        source: "net_received",
      };
    }
  }

  return {
    providerFeeConfirmedMinor: null,
    netReceivedMinor: null,
    source: "unknown",
  };
}
