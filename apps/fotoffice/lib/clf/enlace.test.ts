import { describe, expect, it } from "vitest";
import { enlaceDelAlbumClf, interpretarEnlaceClf, textoPreventaClf } from "./enlace";

describe("interpretarEnlaceClf", () => {
  it("el enlace de la preventa de José Ingenieros", () => {
    expect(
      interpretarEnlaceClf("https://www.compramelafoto.com/album/escuela-jose-ingenieros-funes-colacion-7-grado-2026-7c1e4a92/preventa"),
    ).toEqual({ tipo: "slug", slug: "escuela-jose-ingenieros-funes-colacion-7-grado-2026-7c1e4a92" });
  });

  it("sin esquema, con espacios, parámetros y ancla", () => {
    expect(interpretarEnlaceClf("  compramelafoto.com/album/abc-1?utm_source=wa#x ")).toEqual({ tipo: "slug", slug: "abc-1" });
  });

  it("enlace por número de álbum", () => {
    expect(interpretarEnlaceClf("https://www.compramelafoto.com/a/1283")).toEqual({ tipo: "id", id: 1283 });
  });

  it.each([
    "https://compramelafoto.com.evil.io/album/x",
    "https://evil.io/?u=compramelafoto.com/album/x",
    "https://evil.io/compramelafoto.com/album/x",
    "http://www.compramelafoto.com/album/x",
    "https://user@www.compramelafoto.com/album/x",
    "https://www.compramelafoto.com:8443/album/x",
    "https://www.compramelafoto.com/",
    "https://www.compramelafoto.com/a/0",
    "https://www.compramelafoto.com/album/no_vale!",
    "texto cualquiera",
    "",
  ])("rechaza %s", (texto) => {
    expect(interpretarEnlaceClf(texto)).toBeNull();
  });
});

describe("enlaceDelAlbumClf", () => {
  it("con preventa apunta a /preventa", () => {
    expect(enlaceDelAlbumClf({ slug: "abc", tienePreventa: true })).toBe("https://www.compramelafoto.com/album/abc/preventa");
  });
  it("sin preventa, al álbum", () => {
    expect(enlaceDelAlbumClf({ slug: "abc", tienePreventa: false })).toBe("https://www.compramelafoto.com/album/abc");
  });
});

describe("textoPreventaClf", () => {
  const AHORA = new Date("2026-11-07T15:00:00-03:00");
  it("abierta: fecha en hora de Buenos Aires", () => {
    expect(textoPreventaClf({ tienePreventa: true, preventaCierraEl: new Date("2026-11-15T23:59:00-03:00") }, AHORA)).toBe("Preventa: cierra el 15/11/2026");
  });
  it("vencida", () => {
    expect(textoPreventaClf({ tienePreventa: true, preventaCierraEl: new Date("2026-11-01T23:59:00-03:00") }, AHORA)).toBe("Preventa cerrada");
  });
  it("sin fecha y sin preventa", () => {
    expect(textoPreventaClf({ tienePreventa: true, preventaCierraEl: null }, AHORA)).toBe("Preventa sin fecha de cierre");
    expect(textoPreventaClf({ tienePreventa: false, preventaCierraEl: null }, AHORA)).toBeNull();
  });
});
