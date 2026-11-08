import { describe, expect, it } from "vitest";
import { esDireccionPublica, normalizarUrl } from "./url";

describe("normalizarUrl", () => {
  it("la misma noticia con otra forma da la misma dirección", () => {
    const base = "https://petapixel.com/2026/11/05/nueva-camara";
    for (const v of [
      "https://petapixel.com/2026/11/05/nueva-camara",
      "http://www.petapixel.com/2026/11/05/nueva-camara/",
      "https://PetaPixel.com/2026/11/05/nueva-camara?utm_source=x&utm_medium=y#comentarios",
      " https://m.petapixel.com/2026/11/05/nueva-camara?fbclid=abc ",
    ]) {
      expect(normalizarUrl(v)).toBe(base);
    }
  });

  it("conserva los parámetros que no son de rastreo, ordenados", () => {
    expect(normalizarUrl("https://ejemplo.com.ar/nota?p=2&id=10&utm_campaign=z")).toBe("https://ejemplo.com.ar/nota?id=10&p=2");
  });

  it("la portada queda sin barra", () => {
    expect(normalizarUrl("https://www.ejemplo.com/")).toBe("https://ejemplo.com");
  });

  it("lo que no es http(s) o no es dirección: null", () => {
    expect(normalizarUrl("ftp://ejemplo.com/a")).toBeNull();
    expect(normalizarUrl("no es una url")).toBeNull();
    expect(normalizarUrl("")).toBeNull();
    expect(normalizarUrl(null)).toBeNull();
    expect(normalizarUrl("http://localhost/a")).toBeNull();
  });
});

describe("esDireccionPublica", () => {
  it("sólo dominios públicos", () => {
    expect(esDireccionPublica("https://petapixel.com/a")).toBe(true);
    expect(esDireccionPublica("http://169.254.169.254/latest/meta-data")).toBe(false);
    expect(esDireccionPublica("http://10.0.0.1/a")).toBe(false);
    expect(esDireccionPublica("http://[::1]/a")).toBe(false);
    expect(esDireccionPublica("http://localhost:3000/a")).toBe(false);
    expect(esDireccionPublica("http://servidor.internal/a")).toBe(false);
    expect(esDireccionPublica("https://usuario:clave@ejemplo.com/a")).toBe(false);
    expect(esDireccionPublica("file:///etc/passwd")).toBe(false);
  });
});
