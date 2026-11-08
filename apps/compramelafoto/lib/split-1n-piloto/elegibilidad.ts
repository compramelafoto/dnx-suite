import { ReferralProgram, REFERRAL_PROGRAM_FEE_SHARE } from "@/lib/referral/referral-program";
import type { PilotoConfig } from "./config";

export type ElegibilidadInput = {
  config: PilotoConfig;
  albumId: number;
  photographerUserId: number | null;
  /** Referidor activo del fotógrafo (programa de fotógrafos), o null si no tiene. */
  referrerUserId: number | null;
  items: Array<{ productType: string }>;
  tieneVideos: boolean;
  esCanje: boolean;
  esPagoSimulado: boolean;
  origenEstandar: boolean;
};

export type Elegibilidad =
  | { ok: true; receivers: { fotografo: string; referidor: string | null } }
  | { ok: false; motivo: string };

/**
 * ¿Esta compra va por el piloto? Cualquier "no" la deja en Checkout Pro, sin error para el
 * comprador. Sólo fotos digitales: impresiones, videos y canjes tienen su propia contabilidad
 * y quedan para después.
 */
export function evaluarElegibilidadPiloto(input: ElegibilidadInput): Elegibilidad {
  const { config } = input;
  if (!config.enabled) return { ok: false, motivo: "piloto_apagado" };
  if (!config.albumIds.has(input.albumId)) return { ok: false, motivo: "album_fuera_de_piloto" };
  if (input.esPagoSimulado || input.esCanje || !input.origenEstandar) {
    return { ok: false, motivo: "compra_especial" };
  }
  const soloDigital =
    input.items.length > 0 && input.items.every((it) => it.productType === "DIGITAL");
  if (!soloDigital || input.tieneVideos) return { ok: false, motivo: "carrito_no_solo_digital" };

  const fotografo =
    input.photographerUserId != null ? config.receiverByUserId.get(input.photographerUserId) : undefined;
  if (!fotografo) return { ok: false, motivo: "fotografo_sin_consentimiento" };

  let referidor: string | null = null;
  if (input.referrerUserId != null) {
    referidor = config.receiverByUserId.get(input.referrerUserId) ?? null;
    if (!referidor) return { ok: false, motivo: "referidor_sin_consentimiento" };
  }
  return { ok: true, receivers: { fotografo, referidor } };
}

export type RepartoPiloto = { fotografo: number; referidor: number; plataforma: number };

/**
 * Reparto en pesos enteros. El fotógrafo cobra el precio (total menos el recargo de la
 * plataforma); el recargo se parte con el referidor según el programa de referidos de
 * fotógrafos, y el peso que sobra del redondeo queda para la plataforma.
 */
export function calcularRepartoPiloto(params: {
  totalPesos: number;
  feePesos: number;
  hayReferidor: boolean;
}): RepartoPiloto {
  const fee = Math.max(0, Math.round(params.feePesos));
  const total = Math.round(params.totalPesos);
  const referidor = params.hayReferidor
    ? Math.floor(fee * REFERRAL_PROGRAM_FEE_SHARE[ReferralProgram.PHOTOGRAPHER_REFERRAL])
    : 0;
  return { fotografo: total - fee, referidor, plataforma: fee - referidor };
}
