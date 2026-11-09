import type { PilotoConfig } from "./config";

export type ElegibilidadInput = {
  config: PilotoConfig;
  albumId: number;
  photographerUserId: number | null;
  /** Referidor activo del fotógrafo (programa de fotógrafos), o null si no tiene. */
  referrerUserId: number | null;
  /**
   * Organizador del evento del álbum, si tiene. `porcentaje` es su comisión (0 si el evento no
   * la tiene activa) y `referrerUserId` su referidor activo en el programa de organizadores.
   */
  organizador?: {
    userId: number;
    porcentaje: number;
    /** `organizerCommissionEnabled` del evento, aunque el porcentaje sea 0. */
    comisionActiva?: boolean;
    referrerUserId: number | null;
  } | null;
  /** Álbum de una escuela: tiene su propia comisión y queda fuera del piloto. */
  esEscolar?: boolean;
  items: Array<{ productType: string }>;
  tieneVideos: boolean;
  esCanje: boolean;
  esPagoSimulado: boolean;
  origenEstandar: boolean;
};

export type ReceptoresPiloto = {
  fotografo: string;
  referidor: string | null;
  organizador: string | null;
  referidorOrganizador: string | null;
};

export type Elegibilidad =
  | { ok: true; receivers: ReceptoresPiloto }
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
  if (input.esEscolar) return { ok: false, motivo: "album_escolar" };
  const org = input.organizador ?? null;
  if (org && org.porcentaje >= 100) return { ok: false, motivo: "organizador_cobra_todo" };
  if (input.esPagoSimulado || input.esCanje || !input.origenEstandar) {
    return { ok: false, motivo: "compra_especial" };
  }
  const soloDigital =
    input.items.length > 0 && input.items.every((it) => it.productType === "DIGITAL");
  if (!soloDigital || input.tieneVideos) return { ok: false, motivo: "carrito_no_solo_digital" };

  const fotografo =
    input.photographerUserId != null ? config.receiverByUserId.get(input.photographerUserId) : undefined;
  if (!fotografo) return { ok: false, motivo: "fotografo_sin_consentimiento" };

  // Como CLF (`shouldSkipReferralEarningForEventOrganizer`): el organizador de un evento con
  // comisión activa no cobra además como referidor del fotógrafo en los álbumes de ese evento.
  const referidorEsOrganizador =
    org != null && org.comisionActiva === true && input.referrerUserId === org.userId;
  let referidor: string | null = null;
  if (input.referrerUserId != null && !referidorEsOrganizador) {
    referidor = config.receiverByUserId.get(input.referrerUserId) ?? null;
    if (!referidor) return { ok: false, motivo: "referidor_sin_consentimiento" };
  }

  let organizador: string | null = null;
  if (org && org.porcentaje > 0) {
    organizador = config.receiverByUserId.get(org.userId) ?? null;
    if (!organizador) return { ok: false, motivo: "organizador_sin_consentimiento" };
  }
  let referidorOrganizador: string | null = null;
  if (org && org.referrerUserId != null) {
    referidorOrganizador = config.receiverByUserId.get(org.referrerUserId) ?? null;
    if (!referidorOrganizador) return { ok: false, motivo: "referidor_organizador_sin_consentimiento" };
  }
  return { ok: true, receivers: { fotografo, referidor, organizador, referidorOrganizador } };
}
