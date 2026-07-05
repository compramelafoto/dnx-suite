/** TTL para recordar un pedido PENDING iniciado en este navegador (recuperación < 60 min). */
export const PENDING_ORDER_SESSION_TTL_MS = 60 * 60 * 1000;

export type PendingOrderSession = {
  orderId: number;
  savedAt: number;
  buyerEmail?: string;
};

function storageKey(albumId: string, suffix: string): string {
  return `lastPendingOrder${suffix}_${albumId}`;
}

export function savePendingOrderSession(
  albumId: string,
  data: Omit<PendingOrderSession, "savedAt">
): void {
  if (typeof window === "undefined") return;
  const savedAt = Date.now();
  sessionStorage.setItem(storageKey(albumId, "Id"), String(data.orderId));
  sessionStorage.setItem(storageKey(albumId, "At"), String(savedAt));
  if (data.buyerEmail?.trim()) {
    sessionStorage.setItem(storageKey(albumId, "BuyerEmail"), data.buyerEmail.trim().toLowerCase());
  } else {
    sessionStorage.removeItem(storageKey(albumId, "BuyerEmail"));
  }
}

export function readPendingOrderSession(albumId: string): PendingOrderSession | null {
  if (typeof window === "undefined") return null;
  const idRaw = sessionStorage.getItem(storageKey(albumId, "Id"));
  const atRaw = sessionStorage.getItem(storageKey(albumId, "At"));
  if (!idRaw || !atRaw) return null;
  const orderId = parseInt(idRaw, 10);
  const savedAt = parseInt(atRaw, 10);
  if (!Number.isFinite(orderId) || orderId <= 0 || !Number.isFinite(savedAt)) {
    clearPendingOrderSession(albumId);
    return null;
  }
  if (Date.now() - savedAt > PENDING_ORDER_SESSION_TTL_MS) {
    clearPendingOrderSession(albumId);
    return null;
  }
  const buyerEmail = sessionStorage.getItem(storageKey(albumId, "BuyerEmail")) ?? undefined;
  return { orderId, savedAt, buyerEmail };
}

export function clearPendingOrderSession(albumId: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(storageKey(albumId, "Id"));
  sessionStorage.removeItem(storageKey(albumId, "At"));
  sessionStorage.removeItem(storageKey(albumId, "InitPoint"));
  sessionStorage.removeItem(storageKey(albumId, "BuyerEmail"));
}
