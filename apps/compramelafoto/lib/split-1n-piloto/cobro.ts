import { money } from "@repo/payments/money";
import { calculateDistribution } from "@repo/payments/distribution";
import { pagadorTambienRecibe } from "@/lib/cierre-split-1n/config";
import { calcularRepartoPiloto, type RepartoPiloto } from "./reparto";
import type { MarcaPiloto } from "./snapshot";

export type CobroPreparado =
  | {
      ok: true;
      reparto: RepartoPiloto;
      total: ReturnType<typeof money>;
      distribution: ReturnType<typeof calculateDistribution>;
      partnerReceiverIds: Map<string, string>;
    }
  | { ok: false; codigo: "YA_PAGADO" | "ORDEN_EN_CURSO" | "PAGADOR_ES_RECEPTOR" };

/** Pesos enteros de CLF → centavos de Mercado Pago. */
function enPesos(pesos: number) {
  return money("ARS", BigInt(Math.round(pesos)) * 100n);
}

/**
 * Todo lo que se decide antes de tocar Mercado Pago, sin red: si el pedido se puede cobrar,
 * quién recibe cuánto y con qué receptores. Los montos son fijos (no porcentajes) para que el
 * fotógrafo reciba exactamente el precio de la foto.
 */
export function prepararCobro(params: {
  estadoPedido: string;
  marca: MarcaPiloto | null;
  totalPesos: number;
  feePesos: number;
  receivers: { fotografo: string; referidor: string | null };
  payerEmail: string;
  /** Correos de los receptores según Mercado Pago, incluido el de la cuenta cobradora. */
  correosReceptores: string[];
}): CobroPreparado {
  if (params.estadoPedido !== "PENDING" && params.estadoPedido !== "FAILED") {
    return { ok: false, codigo: "YA_PAGADO" };
  }
  const estado = params.marca?.estado;
  if (estado && estado !== "PENDIENTE") {
    return { ok: false, codigo: "ORDEN_EN_CURSO" };
  }
  if (pagadorTambienRecibe(params.payerEmail, params.correosReceptores)) {
    return { ok: false, codigo: "PAGADOR_ES_RECEPTOR" };
  }

  const reparto = calcularRepartoPiloto({
    totalPesos: params.totalPesos,
    feePesos: params.feePesos,
    hayReferidor: params.receivers.referidor != null,
  });
  const total = enPesos(params.totalPesos);
  const fija = (recipientId: string, pesos: number, priority: number) => ({
    recipientId,
    role: "OTHER" as const,
    kind: "FIXED" as const,
    fixedAmount: enPesos(pesos),
    priority,
    optional: false,
  });
  const rules = [fija("owner", reparto.plataforma, 1), fija("fotografo", reparto.fotografo, 2)];
  const partnerReceiverIds = new Map<string, string>([["fotografo", params.receivers.fotografo]]);
  if (params.receivers.referidor != null) {
    rules.push(fija("referidor", reparto.referidor, 3));
    partnerReceiverIds.set("referidor", params.receivers.referidor);
  }

  const distribution = calculateDistribution({
    total,
    rules,
    rounding: "LARGEST_REMAINDER",
    eligibleRecipientIds: rules.map((r) => r.recipientId),
  });
  return { ok: true, reparto, total, distribution, partnerReceiverIds };
}
