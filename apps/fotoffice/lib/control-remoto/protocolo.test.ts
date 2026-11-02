import { describe, expect, it } from "vitest";
import { sanearComando, sanearEstado } from "./protocolo";

describe("sanearComando", () => {
  it("acepta las órdenes conocidas", () => {
    expect(sanearComando({ tipo: "siguiente" })).toEqual({ tipo: "siguiente" });
    expect(sanearComando({ tipo: "ir", id: "premio:abc" })).toEqual({ tipo: "ir", id: "premio:abc" });
    expect(sanearComando({ tipo: "boton", id: "sortear", extra: 1 })).toEqual({ tipo: "boton", id: "sortear" });
  });

  it("rechaza lo que no es una orden", () => {
    expect(sanearComando(null)).toBeNull();
    expect(sanearComando({ tipo: "borrar" })).toBeNull();
    expect(sanearComando({ tipo: "ir" })).toBeNull();
    expect(sanearComando({ tipo: "boton", id: "x".repeat(200) })).toBeNull();
  });
});

describe("sanearEstado", () => {
  it("exige título y recorta lo demás", () => {
    expect(sanearEstado({})).toBeNull();
    const e = sanearEstado({
      titulo: "Sorteo",
      detalle: "x".repeat(1000),
      botones: [{ id: "sortear", etiqueta: "Sortear", tono: "raro" }, { id: "" }],
      lista: { titulo: "Premios", actual: "a", items: [{ id: "a", etiqueta: "Cámara" }, { etiqueta: "sin id" }] },
    });
    expect(e?.detalle).toHaveLength(300);
    expect(e?.botones).toEqual([{ id: "sortear", etiqueta: "Sortear", tono: "secundario", deshabilitado: false, confirmar: undefined }]);
    expect(e?.lista?.items).toEqual([{ id: "a", etiqueta: "Cámara", grupo: undefined, nota: undefined }]);
  });
});
