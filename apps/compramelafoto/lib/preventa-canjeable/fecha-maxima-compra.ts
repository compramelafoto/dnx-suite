/**
 * Regla de la preventa: todo pack que se vende antes de subir las fotos tiene fecha máxima de
 * compra. La preventa de ese pack cierra en lo primero que pase: vence la fecha o se sube la
 * primera foto del álbum. Desde ahí, las familias compran en la galería.
 *
 * Los packs «después de subir las fotos» (POST_UPLOAD) se venden en la galería y no la necesitan.
 */

export const FALTA_FECHA_MAXIMA =
  "Poné la fecha máxima de compra: después de esa fecha (o cuando subas las fotos) las familias compran en la galería.";

export function esPackDePreventa(availabilityPhase: string | null | undefined): boolean {
  return availabilityPhase !== "POST_UPLOAD";
}

/** `true` si al pack le falta la fecha máxima de compra que la regla exige. */
export function faltaFechaMaxima(pack: { availabilityPhase?: string | null; validUntil?: Date | string | null }): boolean {
  return esPackDePreventa(pack.availabilityPhase) && !pack.validUntil;
}
