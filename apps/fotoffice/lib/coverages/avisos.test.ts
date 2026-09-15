import { describe, expect, it } from "vitest";
import { enTandas, pendientesDeAviso } from "./avisos";

describe("enTandas", () => {
  it("parte la lista en grupos del tamaño pedido", () => {
    expect(enTandas([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("una lista vacía no genera ninguna tanda", () => {
    expect(enTandas([], 5)).toEqual([]);
  });

  it("una lista más corta que la tanda sale entera, en una sola", () => {
    expect(enTandas(["a", "b"], 5)).toEqual([["a", "b"]]);
  });

  it("no pierde ni repite a nadie", () => {
    const gente = Array.from({ length: 53 }, (_, i) => `p${i}`);
    expect(enTandas(gente, 5).flat()).toEqual(gente);
  });

  it("un tamaño de cero no deja el envío dando vueltas sin mandar nada", () => {
    // Con paso cero el bucle nunca avanzaría. Se trata como uno: un correo por tanda es lento,
    // pero sale; cero tandas de cero no sale nunca.
    expect(enTandas([1, 2], 0)).toEqual([[1], [2]]);
    expect(enTandas([1, 2], -3)).toEqual([[1], [2]]);
  });
});

describe("pendientesDeAviso", () => {
  it("saca a quienes ya lo recibieron y deja al resto", () => {
    expect(
      pendientesDeAviso(["ana@x.com", "beto@x.com", "cecilia@x.com"], new Set(["beto@x.com"])),
    ).toEqual(["ana@x.com", "cecilia@x.com"]);
  });

  it("la misma dirección escrita con mayúsculas es la misma persona", () => {
    // Si no, a quien tiene la dirección cargada con mayúsculas en el padrón le llegaría el aviso
    // de nuevo en cada reenvío, para siempre.
    expect(pendientesDeAviso(["Ana@X.com"], new Set(["ana@x.com"]))).toEqual([]);
    expect(pendientesDeAviso(["ana@x.com"], new Set([" ANA@X.COM "]))).toEqual([]);
  });

  it("sin nadie avisado todavía, quedan todos pendientes", () => {
    expect(pendientesDeAviso(["ana@x.com", "beto@x.com"], new Set())).toEqual([
      "ana@x.com",
      "beto@x.com",
    ]);
  });

  it("devuelve la dirección como está en el padrón, no en minúsculas", () => {
    // Es lo que va al campo «para»: normalizarla acá la cambiaría en el correo que sale.
    expect(pendientesDeAviso(["Ana.Perez@X.com"], new Set(["otra@x.com"]))).toEqual([
      "Ana.Perez@X.com",
    ]);
  });
});
