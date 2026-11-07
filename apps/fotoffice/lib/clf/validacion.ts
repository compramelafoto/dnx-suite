import type { MpPaymentFacts } from "@/lib/payments/mp/payment-facts";

/**
 * Validación de una venta de CLF contra el pago real en el Mercado Pago del espacio (etapa 2 de la conexión
 * FOTOFFICE ↔ CLF). Módulo PURO. La cifra que manda es la de Mercado Pago, no la de CLF.
 *
 * Montos de la venta en pesos; los de Mercado Pago llegan en centavos (`MpPaymentFacts`) y se pasan a pesos.
 */

export const VALIDACIONES = [
  "PENDIENTE",
  "VALIDADA",
  "VALIDADA_CUENTA_PROPIA",
  "CON_DIFERENCIA",
  "NO_EN_TU_MP",
  "REINTEGRADA",
  "REINTEGRO_PARCIAL",
] as const;
export type Validacion = (typeof VALIDACIONES)[number];

export const ETIQUETA_VALIDACION: Record<Validacion, string> = {
  PENDIENTE: "Por validar",
  VALIDADA: "Validada",
  VALIDADA_CUENTA_PROPIA: "Validada (cuenta propia)",
  CON_DIFERENCIA: "Con diferencia",
  NO_EN_TU_MP: "No está en tu Mercado Pago",
  REINTEGRADA: "Reintegrada",
  REINTEGRO_PARCIAL: "Reintegro parcial",
};

/** Tolerancia por redondeo, en pesos. */
export const TOLERANCIA_ARS = 1;

export type VentaParaValidar = {
  clfOrderId: number;
  pagoFamiliaArs: number;
  retenidoEsperadoArs: number;
  estadoClf: string;
  cobradorMpUserId: string | null;
};

export type LecturaMp =
  | { ok: true; facts: MpPaymentFacts }
  /** NO_ACCESO: el pago no es de esta cuenta (401/403/404). TEMPORAL: Mercado Pago caído o lento. SIN_COBROS: el espacio no tiene Cobros conectado. */
  | { ok: false; tipo: "NO_ACCESO" | "TEMPORAL" | "SIN_COBROS" };

export type ResultadoValidacion =
  | { validacion: "PENDIENTE" }
  | {
      validacion: Exclude<Validacion, "PENDIENTE">;
      mpBrutoArs: number | null;
      mpComisionPlataformaArs: number | null;
      mpComisionMpArs: number | null;
      mpAcreditadoArs: number | null;
      mpReintegradoArs: number | null;
      reintegradoEl: Date | null;
    };

const aPesos = (minor: number): number => Math.round(minor) / 100;
const igual = (a: number, b: number): boolean => Math.abs(a - b) <= TOLERANCIA_ARS;

export function validarVenta(v: VentaParaValidar, mp: LecturaMp, cuentaDelEspacio: string | null): ResultadoValidacion {
  if (!mp.ok) {
    if (mp.tipo === "TEMPORAL") return { validacion: "PENDIENTE" };
    return {
      validacion: "NO_EN_TU_MP",
      mpBrutoArs: null,
      mpComisionPlataformaArs: null,
      mpComisionMpArs: null,
      mpAcreditadoArs: null,
      mpReintegradoArs: null,
      reintegradoEl: null,
    };
  }

  const f = mp.facts;
  const bruto = aPesos(f.grossMinor);
  const plataforma = aPesos(f.platformFeeMinor);
  const comisionMp = aPesos(f.mpFeeMinor);
  const reintegrado = aPesos(f.refundedMinor);
  const montos = {
    mpBrutoArs: bruto,
    mpComisionPlataformaArs: plataforma,
    mpComisionMpArs: comisionMp,
    mpAcreditadoArs: Math.round((bruto - comisionMp - plataforma) * 100) / 100,
    mpReintegradoArs: reintegrado,
  };

  const reintegradoEnMp = reintegrado > 0 || ["refunded", "charged_back"].includes(f.status.toLowerCase());
  if (reintegradoEnMp || v.estadoClf === "REFUNDED") {
    const total = reintegrado >= bruto - TOLERANCIA_ARS || ["refunded", "charged_back"].includes(f.status.toLowerCase());
    return {
      validacion: total ? "REINTEGRADA" : "REINTEGRO_PARCIAL",
      ...montos,
      mpReintegradoArs: total && reintegrado === 0 ? bruto : reintegrado,
      reintegradoEl: f.lastUpdatedAt ?? f.approvedAt ?? null,
    };
  }

  const referenciaOk = f.externalReference !== null && f.externalReference.trim() === String(v.clfOrderId);
  const brutoOk = igual(bruto, v.pagoFamiliaArs);
  const cuentaPropia = cuentaDelEspacio !== null && v.cobradorMpUserId !== null && cuentaDelEspacio === v.cobradorMpUserId;

  let validacion: Exclude<Validacion, "PENDIENTE">;
  if (!referenciaOk || !brutoOk) validacion = "CON_DIFERENCIA";
  else if (igual(plataforma, v.retenidoEsperadoArs)) validacion = "VALIDADA";
  else if (plataforma === 0 && cuentaPropia) validacion = "VALIDADA_CUENTA_PROPIA";
  else validacion = "CON_DIFERENCIA";

  return { validacion, ...montos, reintegradoEl: null };
}
