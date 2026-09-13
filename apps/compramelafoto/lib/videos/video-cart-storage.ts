/**
 * Carrito de videos del cliente, en `sessionStorage`.
 *
 * Va al lado del carrito de fotos (`album_{id}_items`) y con la misma idea: lo
 * que el cliente elige sobrevive entre la galería y el resumen. Después, el
 * resumen manda las dos listas en el mismo pedido y se paga una sola vez.
 *
 * Todo lo que toca el almacenamiento está envuelto en try/catch: Safari en
 * navegación privada puede tirar excepción al escribir, y quedarse sin carrito
 * es molesto, pero romper la pantalla de compra es perder la venta.
 */

/** Lo mínimo de `Storage` que se usa acá. Inyectable para poder testear. */
export type CartStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

export function videoCartKey(albumId: number): string {
  return `album_${albumId}_videos`;
}

function defaultStorage(): CartStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function readVideoCart(albumId: number, storage?: CartStorage | null): number[] {
  const s = storage ?? defaultStorage();
  if (!s) return [];
  try {
    const raw = s.getItem(videoCartKey(albumId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((n: unknown) => (typeof n === "number" ? n : parseInt(String(n), 10)))
      .filter((n: number) => Number.isFinite(n) && n > 0);
  } catch {
    // Carrito corrupto: vale más una pantalla vacía que una rota.
    return [];
  }
}

function writeVideoCart(albumId: number, ids: number[], storage?: CartStorage | null): void {
  const s = storage ?? defaultStorage();
  if (!s) return;
  try {
    s.setItem(videoCartKey(albumId), JSON.stringify(ids));
  } catch {
    /* sin almacenamiento: la compra sigue, sin memoria entre pantallas */
  }
}

export function addToVideoCart(
  albumId: number,
  videoId: number,
  storage?: CartStorage | null
): number[] {
  const actuales = readVideoCart(albumId, storage);
  if (actuales.includes(videoId)) return actuales;
  const siguiente = [...actuales, videoId];
  writeVideoCart(albumId, siguiente, storage);
  return siguiente;
}

export function removeFromVideoCart(
  albumId: number,
  videoId: number,
  storage?: CartStorage | null
): number[] {
  const siguiente = readVideoCart(albumId, storage).filter((id) => id !== videoId);
  writeVideoCart(albumId, siguiente, storage);
  return siguiente;
}

export function clearVideoCart(albumId: number, storage?: CartStorage | null): void {
  const s = storage ?? defaultStorage();
  if (!s) return;
  try {
    s.removeItem(videoCartKey(albumId));
  } catch {
    /* nada que hacer */
  }
}
