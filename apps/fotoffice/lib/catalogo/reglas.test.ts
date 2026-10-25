import { describe, expect, it } from "vitest";
import {
  CATEGORIAS_PRODUCTO_DNX,
  categoriasFaltantes,
  costoPrevistoMinor,
  formaCiclo,
  normalizarComponentes,
  normalizarCostos,
  normalizarRubro,
  pesosSinDecimales,
  resumenCombo,
  textoDias,
} from "./reglas";

describe("categorías de DNX", () => {
  it("son las 11 de Alboom", () => {
    expect(CATEGORIAS_PRODUCTO_DNX).toHaveLength(11);
    expect(CATEGORIAS_PRODUCTO_DNX[0]).toBe("Evento");
    expect(CATEGORIAS_PRODUCTO_DNX.at(-1)).toBe("Otro");
  });

  it("faltan sólo las que no están, sin mirar mayúsculas ni espacios", () => {
    expect(categoriasFaltantes(["  evento ", "ÁLBUM", "Varios"], ["Evento", "Álbum", "Otro"])).toEqual(["Otro"]);
    expect(categoriasFaltantes([])).toHaveLength(11);
  });
});

describe("combos", () => {
  it("un combo no puede contenerse a sí mismo", () => {
    expect(normalizarComponentes("A", [{ productId: "A", quantity: 1 }])).toEqual({ ok: false, error: "Un combo no puede contenerse a sí mismo." });
  });

  it("cantidades enteras positivas; los repetidos se suman", () => {
    expect(normalizarComponentes("A", [{ productId: "B", quantity: 0 }]).ok).toBe(false);
    expect(normalizarComponentes("A", [{ productId: "B", quantity: 1.5 }]).ok).toBe(false);
    expect(normalizarComponentes("A", [{ productId: "", quantity: 1 }]).ok).toBe(false);
    expect(normalizarComponentes("A", [{ productId: "B", quantity: 2 }, { productId: "C", quantity: 1 }, { productId: "B", quantity: 1 }])).toEqual({
      ok: true,
      valor: [{ productId: "B", quantity: 3 }, { productId: "C", quantity: 1 }],
    });
  });

  it("detecta ciclos directos e indirectos, e ignora las aristas viejas del mismo combo", () => {
    const aristas = new Map([
      ["B", ["C"]],
      ["C", ["A"]],
      ["A", ["X"]],
    ]);
    expect(formaCiclo("A", ["B"], aristas)).toBe(true); // A → B → C → A
    expect(formaCiclo("A", ["X"], aristas)).toBe(false);
    expect(formaCiclo("C", ["D"], new Map([["D", []]]))).toBe(false);
    expect(formaCiclo("B", ["A"], new Map([["A", ["B"]]]))).toBe(true); // A contiene B contiene A
  });

  it("un combo dentro de otro, sin volver, no es ciclo (y no se cuelga con diamantes)", () => {
    const aristas = new Map([
      ["B", ["D"]],
      ["C", ["D"]],
      ["D", []],
    ]);
    expect(formaCiclo("A", ["B", "C"], aristas)).toBe(false);
  });

  it("resumen: suma, ahorro y porcentaje", () => {
    expect(resumenCombo(80_000_00, [{ priceMinor: 50_000_00, quantity: 1 }, { priceMinor: 25_000_00, quantity: 2 }])).toEqual({
      sumaComponentesMinor: 100_000_00,
      ahorroMinor: 20_000_00,
      ahorroPorcentaje: 20,
    });
    expect(resumenCombo(120, [{ priceMinor: 100, quantity: 1 }]).ahorroMinor).toBe(-20);
    expect(resumenCombo(100, []).ahorroPorcentaje).toBeNull();
  });
});

describe("costos-plantilla", () => {
  const fila = { supplierClientId: "", concept: " Laboratorio ", amountMinor: 1500_00, perUnit: true, daysFromEvent: -3 };

  it("normaliza el concepto y el proveedor vacío", () => {
    expect(normalizarCostos([fila])).toEqual({
      ok: true,
      valor: [{ supplierClientId: null, concept: "Laboratorio", amountMinor: 1500_00, perUnit: true, daysFromEvent: -3 }],
    });
  });

  it("rechaza concepto vacío, importe negativo o con fracción de centavo, y días no enteros", () => {
    expect(normalizarCostos([{ ...fila, concept: "  " }]).ok).toBe(false);
    expect(normalizarCostos([{ ...fila, amountMinor: -1 }]).ok).toBe(false);
    expect(normalizarCostos([{ ...fila, amountMinor: 1.5 }]).ok).toBe(false);
    expect(normalizarCostos([{ ...fila, daysFromEvent: 1.5 }]).ok).toBe(false);
    expect(normalizarCostos([{ ...fila, daysFromEvent: 99999 }]).ok).toBe(false);
  });

  it("costo previsto: los fijos una vez, los por unidad × cantidad", () => {
    const costos = [
      { amountMinor: 10_000, perUnit: false },
      { amountMinor: 500, perUnit: true },
    ];
    expect(costoPrevistoMinor(costos, 4)).toBe(12_000);
    expect(costoPrevistoMinor(costos, 0)).toBe(10_000);
  });

  it("texto de los días desde el evento", () => {
    expect(textoDias(0)).toBe("el día del evento");
    expect(textoDias(-1)).toBe("1 día antes del evento");
    expect(textoDias(10)).toBe("10 días después del evento");
  });
});

describe("perfil y formato", () => {
  it("rubro: recorta, vacío es null, tope de largo", () => {
    expect(normalizarRubro("  Coberturas   sociales ")).toEqual({ ok: true, valor: "Coberturas sociales" });
    expect(normalizarRubro("")).toEqual({ ok: true, valor: null });
    expect(normalizarRubro("x".repeat(81)).ok).toBe(false);
  });

  it("pesos sin decimales (es-AR)", () => {
    expect(pesosSinDecimales(150_000_49).replace(/\s/g, " ")).toMatch(/^\$ ?150\.000$/);
  });
});
