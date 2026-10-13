import { describe, expect, it } from "vitest";
import { parseTarjetaCalculo } from "./calculo";
import { applySseEvent, dropEmptyBot } from "./items";

const T = { titulo: "Tu perfil de precios", filas: [{ etiqueta: "Valor hora", valor: "$ 31.250" }], avisos: ["Falta: Software."] };

describe("parseTarjetaCalculo", () => {
  it("acepta la tarjeta del servidor", () => {
    expect(parseTarjetaCalculo(T)).toEqual(T);
  });
  it("sin título o sin filas válidas → null", () => {
    for (const d of [null, "x", {}, { titulo: "", filas: [] }, { titulo: "a", filas: [{ etiqueta: 1, valor: "x" }] }]) {
      expect(parseTarjetaCalculo(d)).toBeNull();
    }
  });
  it("descarta filas y avisos raros y recorta las listas", () => {
    const t = parseTarjetaCalculo({
      titulo: "a",
      filas: [...Array.from({ length: 20 }, (_, i) => ({ etiqueta: `e${i}`, valor: "v" })), { etiqueta: "x" }],
      avisos: ["ok", 3, ...Array.from({ length: 10 }, () => "más")],
    })!;
    expect(t.filas).toHaveLength(12);
    expect(t.avisos).toHaveLength(6);
    expect(t.avisos[0]).toBe("ok");
  });
});

describe("evento calculo", () => {
  it("agrega la tarjeta y deja un bot vacío para que el texto siga debajo", () => {
    const items = applySseEvent([{ kind: "user", text: "hola" }, { kind: "bot", text: "Mirá:" }], "calculo", T);
    expect(items.map((i) => i.kind)).toEqual(["user", "bot", "calculo", "bot"]);
    const siguiente = applySseEvent(items, "text", { delta: "¿Lo guardo?" });
    expect(dropEmptyBot(siguiente).at(-1)).toEqual({ kind: "bot", text: "¿Lo guardo?" });
  });
  it("una tarjeta inválida no agrega nada", () => {
    const items = [{ kind: "user" as const, text: "hola" }];
    expect(applySseEvent(items, "calculo", { titulo: 3 })).toBe(items);
  });
});
