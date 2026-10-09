import { describe, expect, it } from "vitest";
import { cortarEnLineas, datosDeFicha, paraWinAnsi } from "./texto";

describe("paraWinAnsi", () => {
  it("deja intacto el castellano", () => expect(paraWinAnsi("¿Ñandú? «Señal» — “sí”…")).toBe("¿Ñandú? «Señal» — “sí”…"));
  it("saca diacríticos que la fuente no tiene y pone ? a lo demás", () => {
    expect(paraWinAnsi("Łódź")).toBe("?ódz");
    expect(paraWinAnsi("Cámara 📷")).toBe("Cámara ?");
  });
  it("los saltos de línea pasan a espacios", () => expect(paraWinAnsi("uno\ndos")).toBe("uno dos"));
});

describe("cortarEnLineas", () => {
  const medir = (s: string) => s.length;
  it("corta por palabras", () => expect(cortarEnLineas("el río a la siesta", 8, medir, 5)).toEqual(["el río a", "la", "siesta"]));
  it("corta una palabra más larga que la línea", () => expect(cortarEnLineas("abcdefghij", 4, medir, 5)).toEqual(["abcd", "efgh", "ij"]));
  it("con más líneas que el tope, termina en puntos suspensivos", () => {
    expect(cortarEnLineas("uno dos tres cuatro cinco", 7, medir, 2)).toEqual(["uno dos", "tres…"]);
  });
  it("texto vacío, ninguna línea", () => expect(cortarEnLineas("   ", 10, medir, 2)).toEqual([]));
});

describe("datosDeFicha", () => {
  it("arma los textos y la URL de la obra", () => {
    const f = datosDeFicha(
      { title: "Miradas del litoral", slug: "miradas-abc123" },
      { id: "w1", title: "El río", authorName: "Ana Pérez", year: 2025, technique: "Copia pigmentaria" },
      "https://muestrasfotograficas.com",
    );
    expect(f).toEqual({
      muestra: "Miradas del litoral", titulo: "El río", autor: "Ana Pérez", detalle: "2025. Copia pigmentaria",
      url: "https://muestrasfotograficas.com/m/miradas-abc123/o/w1",
    });
  });
  it("sin autor ni datos", () => {
    const f = datosDeFicha({ title: "M", slug: "m" }, { id: "w", title: "T", authorName: " ", year: null, technique: null }, "https://x.com");
    expect([f.autor, f.detalle]).toEqual(["Autor sin indicar", null]);
  });
});
