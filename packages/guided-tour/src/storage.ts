import type { TourOutcome } from "./types";

/**
 * Se recuerda en el navegador si el usuario ya vio (o descartó) cada recorrido.
 * No va a la base: cada app tiene la suya y las cuentas no se comparten, y lo peor que
 * puede pasar en otro equipo es que se ofrezca una vez más, con un clic para descartarlo.
 */
export type TourRecord = { v: number; s: TourOutcome; t: string };

type KeyValueStore = Pick<Storage, "getItem" | "setItem">;

export function storageKey(tourId: string): string {
  return `dnx-tour:${tourId}`;
}

export function readTourRecord(store: KeyValueStore | null, tourId: string): TourRecord | null {
  if (!store) return null;
  try {
    const raw = store.getItem(storageKey(tourId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<TourRecord>;
    if (typeof parsed.v !== "number" || typeof parsed.s !== "string") return null;
    return { v: parsed.v, s: parsed.s as TourOutcome, t: String(parsed.t ?? "") };
  } catch {
    return null;
  }
}

export function writeTourRecord(
  store: KeyValueStore | null,
  tourId: string,
  version: number,
  outcome: TourOutcome,
  now: Date = new Date(),
): void {
  if (!store) return;
  try {
    const record: TourRecord = { v: version, s: outcome, t: now.toISOString() };
    store.setItem(storageKey(tourId), JSON.stringify(record));
  } catch {
    // Navegación privada o almacenamiento lleno: el recorrido se volverá a ofrecer, nada más.
  }
}

/** Se ofrece solo si nunca se vio, o si la pantalla cambió (versión nueva) desde la última vez. */
export function shouldOfferTour(record: TourRecord | null, version: number): boolean {
  return !record || record.v < version;
}

export function safeLocalStorage(): KeyValueStore | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}
