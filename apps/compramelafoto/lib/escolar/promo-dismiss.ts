/**
 * Cierre de los llamadores a la venta escolar: si el fotógrafo toca la X, el
 * aviso no vuelve a aparecer durante 30 días en ese navegador.
 *
 * Puro (sin window): el componente le pasa el valor guardado y la fecha actual.
 * Si el navegador no deja guardar (modo privado, almacenamiento bloqueado), el
 * aviso se muestra igual; sólo se pierde el "no volver a mostrar".
 */

export const ESCOLAR_PROMO_DISMISS_DAYS = 30;
export const ESCOLAR_PROMO_DISMISS_STORAGE_PREFIX = "clf:escolar-promo:cerrado:";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Clave por ubicación (dashboard, álbumes, pedidos…): cerrar uno no apaga los demás. */
export function escolarPromoStorageKey(placement: string): string {
  const clean = String(placement || "general").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-");
  return `${ESCOLAR_PROMO_DISMISS_STORAGE_PREFIX}${clean || "general"}`;
}

/** Valor a guardar al cerrar: la fecha de cierre en milisegundos. */
export function escolarPromoDismissValue(now: Date | number): string {
  const ms = typeof now === "number" ? now : now.getTime();
  return String(Math.floor(ms));
}

/**
 * ¿Sigue cerrado? true sólo si hay una fecha válida, no futura, y pasaron
 * menos de 30 días. Un valor roto o del futuro (reloj cambiado) no oculta el aviso.
 */
export function isEscolarPromoDismissed(
  stored: string | null | undefined,
  now: Date | number,
  days: number = ESCOLAR_PROMO_DISMISS_DAYS
): boolean {
  if (stored == null || stored === "") return false;
  const dismissedAt = Number(stored);
  if (!Number.isFinite(dismissedAt) || dismissedAt <= 0) return false;
  const nowMs = typeof now === "number" ? now : now.getTime();
  if (dismissedAt > nowMs) return false;
  return nowMs - dismissedAt < days * DAY_MS;
}

type StorageLike = Pick<Storage, "getItem" | "setItem">;

/** Lee con try/catch: sin almacenamiento disponible, "no está cerrado". */
export function readEscolarPromoDismissed(
  storage: StorageLike | null | undefined,
  placement: string,
  now: Date | number
): boolean {
  if (!storage) return false;
  try {
    return isEscolarPromoDismissed(storage.getItem(escolarPromoStorageKey(placement)), now);
  } catch {
    return false;
  }
}

/** Guarda con try/catch: si falla, el aviso igual se oculta en esta visita. */
export function writeEscolarPromoDismissed(
  storage: StorageLike | null | undefined,
  placement: string,
  now: Date | number
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(escolarPromoStorageKey(placement), escolarPromoDismissValue(now));
    return true;
  } catch {
    return false;
  }
}
