import type { PilotoConfig } from "./config";

export type ElegibilidadInput = {
  config: PilotoConfig;
  albumId: number;
  photographerUserId: number | null;
  /** Referidor activo del fotógrafo (programa de fotógrafos), o null si no tiene. */
  referrerUserId: number | null;
  /** El álbum es de un evento: tiene organizador con comisión, que el piloto todavía no reparte. */
  tieneEvento?: boolean;
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
  if (input.tieneEvento) return { ok: false, motivo: "album_con_organizador" };
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
