import { describe, expect, it } from "vitest";
import { fotosSinOriginal, leerEstadoFotolibro } from "./estado";
import { confirmarOriginales } from "./operaciones";

const foto = (id: string, extra: Record<string, unknown> = {}) => ({ id, url: `https://x/${id}.jpg`, w: 3, h: 2, ...extra });

describe("originales que suben de fondo", () => {
  const e = leerEstadoFotolibro(
    {
      fotolibro: {
        fotos: [foto("a", { claveOriginal: "k/a" }), foto("b", { claveOriginal: "k/b" }), foto("c")],
        pliegos: [{ todo: { fotos: ["a", "b", "c"] } }],
      },
    },
    1,
  );

  it("se guardan y se leen con su clave", () => {
    expect(e.fotos[0]!.claveOriginal).toBe("k/a");
    expect(e.fotos[2]!.claveOriginal).toBeUndefined();
  });

  it("no se puede imprimir una foto puesta cuyo original no llegó", () => {
    expect(fotosSinOriginal(e).map((f) => f.id)).toEqual(["a", "b"]);
  });

  it("al confirmar, la que llegó queda lista y la que no queda marcada", () => {
    const x = confirmarOriginales(e, { "k/a": true, "k/b": false });
    expect(x.fotos[0]).not.toHaveProperty("claveOriginal");
    expect(x.fotos[1]).toMatchObject({ claveOriginal: "k/b", faltaOriginal: true });
    expect(fotosSinOriginal(x).map((f) => f.id)).toEqual(["b"]);
  });

  it("sin nada que confirmar devuelve el mismo estado", () => {
    expect(confirmarOriginales(e, { "otra": true })).toBe(e);
  });
});
