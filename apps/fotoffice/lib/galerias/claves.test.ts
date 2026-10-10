import { describe, expect, it } from "vitest";
import { analizarClave, claveDeObjeto, claveEsDe, claveMini, claveOriginal, claveVista, clavesDeFoto, esClaveDeGaleria, esPrefijoDeGaleria, prefijoDeGaleria } from "./claves";

describe("claves R2 de la galería", () => {
  it("arma las tres claves bajo galerias/<workspace>/<galeria>/<foto>/", () => {
    expect(claveOriginal("ws1", "g1", "f1")).toBe("galerias/ws1/g1/f1/original");
    expect(claveVista("ws1", "g1", "f1")).toBe("galerias/ws1/g1/f1/vista.jpg");
    expect(claveMini("ws1", "g1", "f1")).toBe("galerias/ws1/g1/f1/mini.jpg");
    expect(clavesDeFoto("ws1", "g1", "f1")).toEqual({
      original: "galerias/ws1/g1/f1/original",
      vista: "galerias/ws1/g1/f1/vista.jpg",
      mini: "galerias/ws1/g1/f1/mini.jpg",
    });
    expect(prefijoDeGaleria("ws1", "g1")).toBe("galerias/ws1/g1/");
  });

  it("las claves que arma son válidas, también con ids de cuid", () => {
    for (const t of ["original", "vista", "mini"] as const) {
      expect(esClaveDeGaleria(claveDeObjeto("cmabc123xyz", "cmdef456uvw", "cmghi789rst", t))).toBe(true);
    }
  });

  it("se niega a armar una clave con ids raros", () => {
    for (const malo of ["", "a/b", "..", "a.b", "a b", "ñ"]) {
      expect(() => claveOriginal(malo, "g", "f"), malo).toThrow();
      expect(() => claveOriginal("w", malo, "f"), malo).toThrow();
      expect(() => claveOriginal("w", "g", malo), malo).toThrow();
    }
  });

  it("rechaza lo que no sea exactamente una clave de galería", () => {
    for (const mala of [
      "adjuntos/ws/00000000-0000-0000-0000-000000000000",
      "galerias/ws1/g1/f1/original.jpg",
      "galerias/ws1/g1/f1/foto.jpg",
      "galerias/ws1/g1/f1/",
      "galerias/ws1/g1/original",
      "galerias/ws1/../g1/f1/original",
      "galerias/ws1/g1/f1/original/extra",
      "galerias//g1/f1/original",
      "/galerias/ws1/g1/f1/original",
      "galerias/ws1/g1/f1/original\n",
      "", null, undefined, 5,
    ]) {
      expect(esClaveDeGaleria(mala), String(mala)).toBe(false);
    }
  });

  it("analiza las partes y comprueba a qué galería pertenece", () => {
    expect(analizarClave("galerias/ws1/g1/f1/mini.jpg")).toEqual({ workspaceId: "ws1", galeriaId: "g1", fotoId: "f1", tipo: "mini" });
    expect(analizarClave("galerias/ws1/g1/f1/vista.jpg")?.tipo).toBe("vista");
    expect(analizarClave("galerias/ws1/g1/f1/original")?.tipo).toBe("original");
    expect(analizarClave("otra/cosa")).toBeNull();
    expect(claveEsDe("galerias/ws1/g1/f1/original", "ws1", "g1")).toBe(true);
    expect(claveEsDe("galerias/ws1/g1/f1/original", "ws2", "g1")).toBe(false);
    expect(claveEsDe("galerias/ws1/g1/f1/original", "ws1", "g2")).toBe(false);
    expect(claveEsDe("basura", "ws1", "g1")).toBe(false);
  });

  it("el prefijo de una galería tiene forma estricta", () => {
    expect(esPrefijoDeGaleria("galerias/ws1/g1/")).toBe(true);
    for (const malo of ["galerias/ws1/g1", "galerias/ws1/", "galerias/", "galerias/ws1/g1/f1/", "galerias/../g1/", 3]) {
      expect(esPrefijoDeGaleria(malo), String(malo)).toBe(false);
    }
  });
});
