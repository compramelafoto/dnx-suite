import { describe, expect, it } from "vitest";

import { readTourRecord, shouldOfferTour, storageKey, writeTourRecord } from "./storage";

function memory() {
  const map = new Map<string, string>();
  return { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v), map };
}

describe("registro del recorrido", () => {
  it("se ofrece la primera vez y no después de verlo", () => {
    const store = memory();
    expect(shouldOfferTour(readTourRecord(store, "clf-album"), 1)).toBe(true);
    writeTourRecord(store, "clf-album", 1, "done", new Date("2026-11-01T12:00:00Z"));
    expect(readTourRecord(store, "clf-album")).toEqual({ v: 1, s: "done", t: "2026-11-01T12:00:00.000Z" });
    expect(shouldOfferTour(readTourRecord(store, "clf-album"), 1)).toBe(false);
  });

  it("descartarlo con Ahora no también cuenta", () => {
    const store = memory();
    writeTourRecord(store, "x", 1, "dismissed");
    expect(shouldOfferTour(readTourRecord(store, "x"), 1)).toBe(false);
  });

  it("vuelve a ofrecerse si la pantalla sube de versión", () => {
    const store = memory();
    writeTourRecord(store, "x", 1, "skipped");
    expect(shouldOfferTour(readTourRecord(store, "x"), 2)).toBe(true);
  });

  it("un valor roto se trata como no visto", () => {
    const store = memory();
    store.map.set(storageKey("x"), "{no es json");
    expect(readTourRecord(store, "x")).toBeNull();
  });

  it("sin almacenamiento no rompe", () => {
    expect(readTourRecord(null, "x")).toBeNull();
    expect(() => writeTourRecord(null, "x", 1, "done")).not.toThrow();
  });
});
