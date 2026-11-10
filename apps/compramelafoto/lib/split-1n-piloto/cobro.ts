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
  | { ok: false; codigo: "YA_PAGADO" | "ORDEN_EN_CURSO" | "PAGADOR_ES_RECEPTOR" | "ELIGIO_MERCADO_PAGO" };

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
  if (estado === "CHECKOUT_PRO" || estado === "CHECKOUT_SPLIT") return { ok: false, codigo: "ELIGIO_MERCADO_PAGO" };
  if (estado && estado !== "PENDIENTE") {
    return { ok: false, codigo: "ORDEN_EN_CURSO" };
  }
  if (pagadorTambienRecibe(params.payerEmail, params.correosReceptores)) {
    return { ok: false, codigo: "PAGADOR_ES_RECEPTOR" };
  }

  const reparto = repartoDelPedido(params);
  const partes = partesDelPedido(reparto, params.receivers);
  const { total, distribution, partnerReceiverIds } = armarDistribucion({
    totalPesos: params.totalPesos,
    plataformaPesos: reparto.plataforma,
    partes,
  });
  return { ok: true, reparto, total, distribution, partnerReceiverIds };
}

/**
 * Reparto de un pedido según sus receptores: un rol sin receptor no cobra (el organizador sin
 * receptor no cobra su porcentaje y queda para el fotógrafo, como en la contabilidad de CLF).
 */
export function repartoDelPedido(params: {
  totalPesos: number;
  feePesos: number;
  basePesos?: number;
  porcentajeOrganizador?: number;
  receivers: ReceptoresCobro;
}): RepartoPiloto {
  const r = params.receivers;
  const organizador = r.organizador ?? null;
  return calcularRepartoPiloto({
    totalPesos: params.totalPesos,
    feePesos: params.feePesos,
    basePesos: params.basePesos,
    hayReferidor: r.referidor != null,
    porcentajeOrganizador: organizador != null ? params.porcentajeOrganizador ?? 0 : 0,
    hayReferidorOrganizador: (r.referidorOrganizador ?? null) != null,
  });
}

/** Lo que cobra una cuenta de Mercado Pago por un rol en un pedido. */
export type ParteReparto = { rol: string; receptor: string; pesos: number };

/**
 * Rol → receptor y monto de un pedido, en orden de prioridad. Un rol sin receptor o con monto
 * cero no va (el fotógrafo va siempre).
 */
export function partesDelPedido(reparto: RepartoPiloto, r: ReceptoresCobro): ParteReparto[] {
  const partes: ParteReparto[] = [{ rol: "fotografo", receptor: r.fotografo, pesos: reparto.fotografo }];
  if (r.referidor != null && reparto.referidor > 0) {
    partes.push({ rol: "referidor", receptor: r.referidor, pesos: reparto.referidor });
  }
  const organizador = r.organizador ?? null;
  if (organizador != null && reparto.organizador > 0) {
    partes.push({ rol: "organizador", receptor: organizador, pesos: reparto.organizador });
  }
  const referidorOrganizador = r.referidorOrganizador ?? null;
  if (referidorOrganizador != null && reparto.referidorOrganizador > 0) {
    partes.push({ rol: "referidor_organizador", receptor: referidorOrganizador, pesos: reparto.referidorOrganizador });
  }
  return partes;
}

/**
 * Reglas fijas de la orden: la plataforma (`owner`) y una regla por cuenta. Las partes de una
 * misma cuenta se suman en la primera que aparece, que le da su `recipientId` (el rol). Si ese
 * rol ya lo usa otra cuenta (dos fotógrafos en un carrito de evento), se numera: `fotografo_2`.
 */
export function armarDistribucion(params: {
  totalPesos: number;
  plataformaPesos: number;
  partes: ParteReparto[];
}) {
  const porReceptor = new Map<string, { recipientId: string; pesos: number }>();
  const usados = new Set<string>(["owner"]);
  for (const { rol, receptor, pesos } of params.partes) {
    const previo = porReceptor.get(receptor);
    if (previo) {
      previo.pesos += pesos;
      continue;
    }
    let recipientId = rol;
    for (let n = 2; usados.has(recipientId); n++) recipientId = `${rol}_${n}`;
    usados.add(recipientId);
    porReceptor.set(receptor, { recipientId, pesos });
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
  const rules = [fija("owner", params.plataformaPesos, 1)];
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
  return { total, distribution, partnerReceiverIds };
}
