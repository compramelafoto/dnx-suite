import { describe, expect, it } from "vitest";
import { codigoDeError, esVersionVieja, leerAvisoDeError } from "./error-pantalla-puro";

describe("leerAvisoDeError", () => {
  it("acepta un aviso completo y recorta lo largo", () => {
    const a = leerAvisoDeError({ alcance: "PAGINA", ruta: "/proyectos/en-curso", mensaje: "x".repeat(5000), pila: "  en algún lado  " });
    expect(a).toMatchObject({ alcance: "PAGINA", ruta: "/proyectos/en-curso", pila: "en algún lado", nombre: null, digest: null });
    expect(a?.mensaje).toHaveLength(2000);
  });

  it("rechaza lo que no tiene alcance o ruta", () => {
    expect(leerAvisoDeError(null)).toBeNull();
    expect(leerAvisoDeError("hola")).toBeNull();
    expect(leerAvisoDeError({ alcance: "OTRO", ruta: "/" })).toBeNull();
    expect(leerAvisoDeError({ alcance: "GLOBAL", ruta: "   " })).toBeNull();
  });

  it("sin mensaje guarda un texto fijo", () => {
    expect(leerAvisoDeError({ alcance: "GLOBAL", ruta: "/", mensaje: 42 })?.mensaje).toBe("(sin mensaje)");
  });
});

describe("esVersionVieja", () => {
  it("reconoce las fallas de una pestaña abierta durante una publicación", () => {
    expect(esVersionVieja({ name: "ChunkLoadError", message: "Loading chunk 123 failed." })).toBe(true);
    expect(esVersionVieja({ message: "Failed to fetch dynamically imported module: https://x/_next/a.js" })).toBe(true);
    expect(esVersionVieja({ message: 'Failed to find Server Action "abc". This request might be from an older or newer deployment.' })).toBe(true);
  });

  it("no confunde una falla común", () => {
    expect(esVersionVieja({ name: "TypeError", message: "Cannot read properties of undefined (reading 'id')" })).toBe(false);
  });
});

describe("codigoDeError", () => {
  it("son los últimos 8 caracteres en mayúsculas", () => {
    expect(codigoDeError("cmviivfr6000fjv08o5p8zryy")).toBe("O5P8ZRYY");
  });
});
