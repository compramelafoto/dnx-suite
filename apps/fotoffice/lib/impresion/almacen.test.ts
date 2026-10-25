import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/ficha/adjuntos-r2", () => ({ clienteR2Privado: () => ({}), bucketR2Privado: () => "b", esNoEncontrado: () => false }));
const { claveImpresion } = await import("./almacen");

describe("claves de impresión", () => {
  it("arma la ruta por workspace, preparación y tipo", () => {
    expect(claveImpresion("ws1", "prep1", "original", "abc", "jpg")).toBe("fotoffice/impresion/ws1/prep1/original/abc.jpg");
  });
  it("no deja meter rutas en los ids", () => {
    expect(() => claveImpresion("ws1", "../x", "final", "abc", "jpg")).toThrow();
    expect(() => claveImpresion("ws1", "p", "final", "a/b", "jpg")).toThrow();
    expect(() => claveImpresion("ws1", "p", "final", "a", "j/pg")).toThrow();
  });
});
