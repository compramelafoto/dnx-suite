import { afterEach, describe, expect, it, vi } from "vitest";
import { checkRateLimit, clientIp, resetRateLimit } from "./rate-limit";
import { normalizeGeocodeQuery } from "./nominatim";

afterEach(() => {
  resetRateLimit();
  vi.useRealTimers();
});

describe("el freno del proxy de geocodificación", () => {
  it("deja pasar hasta el tope y corta el siguiente", () => {
    for (let i = 0; i < 3; i++) {
      expect(checkRateLimit({ key: "ip", limit: 3, windowMs: 60_000 }).allowed).toBe(true);
    }
    expect(checkRateLimit({ key: "ip", limit: 3, windowMs: 60_000 }).allowed).toBe(false);
  });

  it("cuenta por origen: el cupo de uno no frena al otro", () => {
    checkRateLimit({ key: "uno", limit: 1, windowMs: 60_000 });
    expect(checkRateLimit({ key: "uno", limit: 1, windowMs: 60_000 }).allowed).toBe(false);
    expect(checkRateLimit({ key: "otro", limit: 1, windowMs: 60_000 }).allowed).toBe(true);
  });

  it("libera el cupo cuando pasa la ventana", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-17T10:00:00Z"));
    checkRateLimit({ key: "ip", limit: 1, windowMs: 60_000 });
    expect(checkRateLimit({ key: "ip", limit: 1, windowMs: 60_000 }).allowed).toBe(false);

    vi.setSystemTime(new Date("2026-09-17T10:01:01Z"));
    expect(checkRateLimit({ key: "ip", limit: 1, windowMs: 60_000 }).allowed).toBe(true);
  });

  it("toma la primera dirección de x-forwarded-for y cae en un valor fijo sin cabeceras", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" }))).toBe("1.2.3.4");
    expect(clientIp(new Headers({ "x-real-ip": "9.9.9.9" }))).toBe("9.9.9.9");
    expect(clientIp(new Headers())).toBe("desconocido");
  });
});

describe("la consulta que se le manda a Nominatim", () => {
  it("descarta lo que no llega al mínimo", () => {
    expect(normalizeGeocodeQuery("ab")).toBeNull();
    expect(normalizeGeocodeQuery("   ")).toBeNull();
    expect(normalizeGeocodeQuery(null)).toBeNull();
  });

  it("recorta los extremos y el largo", () => {
    expect(normalizeGeocodeQuery("  Rosario  ")).toBe("Rosario");
    expect(normalizeGeocodeQuery("x".repeat(500))?.length).toBe(200);
  });
});
