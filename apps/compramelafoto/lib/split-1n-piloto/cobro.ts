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

/** Receptores de Mercado Pago por rol. Sólo el fotógrafo es obligatorio. */
export type ReceptoresCobro = {
  fotografo: string;
  referidor: string | null;
  organizador?: string | null;
  referidorOrganizador?: string | null;
};

/** Pesos enteros de CLF → centavos de Mercado Pago. */
function enPesos(pesos: number) {
  return money("ARS", BigInt(Math.round(pesos)) * 100n);
}

/**
 * Todo lo que se decide antes de tocar Mercado Pago, sin red: si el pedido se puede cobrar,
 * quién recibe cuánto y con qué receptores. Los montos son fijos (no porcentajes) para que
 * cada parte reciba exactamente lo que dice la contabilidad de CLF.
 *
 * Si una misma cuenta cumple dos roles (por ejemplo, referidora del fotógrafo y del
 * organizador), va una sola vez en la orden con la suma: así no depende de que Mercado Pago
 * acepte un receptor repetido. El reparto por rol queda igual en la marca del pedido.
 */
export function prepararCobro(params: {
  estadoPedido: string;
  marca: MarcaPiloto | null;
  totalPesos: number;
  feePesos: number;
  /** Precio de la foto según CLF (`baseFromTotal`); ver `calcularRepartoPiloto`. */
  basePesos?: number;
  porcentajeOrganizador?: number;
  receivers: ReceptoresCobro;
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

  const r = params.receivers;
  const organizador = r.organizador ?? null;
  const referidorOrganizador = r.referidorOrganizador ?? null;
  const reparto = calcularRepartoPiloto({
    totalPesos: params.totalPesos,
    feePesos: params.feePesos,
    basePesos: params.basePesos,
    hayReferidor: r.referidor != null,
    porcentajeOrganizador: organizador != null ? params.porcentajeOrganizador ?? 0 : 0,
    hayReferidorOrganizador: referidorOrganizador != null,
  });

  // Rol → receptor y monto, en orden de prioridad. Los receptores repetidos se suman al primero.
  const partes: Array<[string, string, number]> = [["fotografo", r.fotografo, reparto.fotografo]];
  if (r.referidor != null && reparto.referidor > 0) partes.push(["referidor", r.referidor, reparto.referidor]);
  if (organizador != null && reparto.organizador > 0) {
    partes.push(["organizador", organizador, reparto.organizador]);
  }
  if (referidorOrganizador != null && reparto.referidorOrganizador > 0) {
    partes.push(["referidor_organizador", referidorOrganizador, reparto.referidorOrganizador]);
  }
  const porReceptor = new Map<string, { recipientId: string; pesos: number }>();
  for (const [rol, receptor, pesos] of partes) {
    const previo = porReceptor.get(receptor);
    if (previo) previo.pesos += pesos;
    else porReceptor.set(receptor, { recipientId: rol, pesos });
  }

  const total = enPesos(params.totalPesos);
  const fija = (recipientId: string, pesos: number, priority: number) => ({
    recipientId,
    role: "OTHER" as const,
    kind: "FIXED" as const,
    fixedAmount: enPesos(pesos),
    priority,
    optional: false,
  });
  const rules = [fija("owner", reparto.plataforma, 1)];
  const partnerReceiverIds = new Map<string, string>();
  for (const [receptor, { recipientId, pesos }] of porReceptor) {
    rules.push(fija(recipientId, pesos, rules.length + 1));
    partnerReceiverIds.set(recipientId, receptor);
  }

  const distribution = calculateDistribution({
    total,
    rules,
    rounding: "LARGEST_REMAINDER",
    eligibleRecipientIds: rules.map((rule) => rule.recipientId),
  });
  return { ok: true, reparto, total, distribution, partnerReceiverIds };
}
