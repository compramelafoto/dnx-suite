import { describe, expect, it } from "vitest";
import {
  expandirConsumo,
  type ComponenteCombo,
  type LineaVendida,
  type Receta,
} from "./consumo";

const r = (productId: string, insumoId: string, quantity = 1, porCada = 1): Receta => ({
  productId,
  insumoId,
  quantity,
  porCada,
});
const validos = new Set(["kit", "sobre", "bolsa"]);
const linea = (productId: string | null, qty: number, ref = "a"): LineaVendida => ({
  ref,
  productId,
  qty,
});

describe("expandirConsumo", () => {
  it("foto carnet gasta 1 copia y 1 sobre por unidad", () => {
    expect(
      expandirConsumo([linea("carnet", 3)], [r("carnet", "kit"), r("carnet", "sobre")], [], validos),
    ).toEqual([
      { ref: "a", insumoId: "kit", qty: 3 },
      { ref: "a", insumoId: "sobre", qty: 3 },
    ]);
  });

  it("15x20 gasta 2 copias", () => {
    expect(expandirConsumo([linea("p1520", 4)], [r("p1520", "kit", 2)], [], validos)).toEqual([
      { ref: "a", insumoId: "kit", qty: 8 },
    ]);
  });

  it("combo desarma componentes con cantidades y suma su receta propia", () => {
    const combos: ComponenteCombo[] = [
      { comboProductId: "C", componentProductId: "p1520", quantity: 2 },
      { comboProductId: "C", componentProductId: "carnet", quantity: 1 },
    ];
    const recetas = [
      r("p1520", "kit", 2),
      r("carnet", "kit"),
      r("carnet", "sobre"),
      r("C", "bolsa"),
    ];
    expect(expandirConsumo([linea("C", 2)], recetas, combos, validos)).toEqual([
      { ref: "a", insumoId: "bolsa", qty: 2 },
      { ref: "a", insumoId: "kit", qty: 10 },
      { ref: "a", insumoId: "sobre", qty: 2 },
    ]);
  });

  it("combo dentro de combo", () => {
    const combos: ComponenteCombo[] = [
      { comboProductId: "C1", componentProductId: "C2", quantity: 3 },
      { comboProductId: "C2", componentProductId: "p1015", quantity: 1 },
    ];
    expect(expandirConsumo([linea("C1", 1)], [r("p1015", "kit")], combos, validos)).toEqual([
      { ref: "a", insumoId: "kit", qty: 3 },
    ]);
  });

  it("servicio sin stock con receta igual consume", () => {
    expect(expandirConsumo([linea("servicio", 1)], [r("servicio", "sobre")], [], validos)).toEqual([
      { ref: "a", insumoId: "sobre", qty: 1 },
    ]);
  });

  it("ignora insumos que ya no son válidos", () => {
    expect(
      expandirConsumo([linea("carnet", 1)], [r("carnet", "viejo"), r("carnet", "kit")], [], validos),
    ).toEqual([{ ref: "a", insumoId: "kit", qty: 1 }]);
  });

  it("renglón suelto sin producto no consume", () => {
    expect(expandirConsumo([linea(null, 5)], [r("carnet", "kit")], [], validos)).toEqual([]);
  });

  it("línea con cantidad cero o negativa no consume", () => {
    expect(
      expandirConsumo([linea("carnet", 0), linea("carnet", -1, "b")], [r("carnet", "kit")], [], validos),
    ).toEqual([]);
  });

  it("3 polaroid 7,5x10 gastan 2 copias", () => {
    const recetas = [r("pol", "kit", 1, 2)];
    const kit = (qty: number) => expandirConsumo([linea("pol", qty)], recetas, [], validos);
    expect(kit(3)).toEqual([{ ref: "a", insumoId: "kit", qty: 2 }]);
    expect(kit(2)).toEqual([{ ref: "a", insumoId: "kit", qty: 1 }]);
    expect(kit(1)).toEqual([{ ref: "a", insumoId: "kit", qty: 1 }]);
  });

  it("polaroid 9x13 gasta 2 copias por hoja de 2", () => {
    expect(expandirConsumo([linea("pol", 3)], [r("pol", "kit", 2, 2)], [], validos)).toEqual([
      { ref: "a", insumoId: "kit", qty: 4 },
    ]);
  });

  it("combo redondea por componente", () => {
    const combos: ComponenteCombo[] = [
      { comboProductId: "C", componentProductId: "pol", quantity: 3 },
    ];
    expect(expandirConsumo([linea("C", 1)], [r("pol", "kit", 1, 2)], combos, validos)).toEqual([
      { ref: "a", insumoId: "kit", qty: 2 },
    ]);
  });

  it("el mismo componente por dos caminos suma unidades antes de redondear", () => {
    const combos: ComponenteCombo[] = [
      { comboProductId: "C", componentProductId: "pol", quantity: 1 },
      { comboProductId: "C", componentProductId: "D", quantity: 1 },
      { comboProductId: "D", componentProductId: "pol", quantity: 1 },
    ];
    // 2 unidades de pol en total, 1 cada 2 => 1 (no 2).
    expect(expandirConsumo([linea("C", 1)], [r("pol", "kit", 1, 2)], combos, validos)).toEqual([
      { ref: "a", insumoId: "kit", qty: 1 },
    ]);
  });

  it("agrupa por ref y ordena por ref e insumo", () => {
    const out = expandirConsumo(
      [linea("carnet", 1, "b"), linea("carnet", 1, "a"), linea("carnet", 2, "a")],
      [r("carnet", "sobre"), r("carnet", "kit")],
      [],
      validos,
    );
    expect(out).toEqual([
      { ref: "a", insumoId: "kit", qty: 3 },
      { ref: "a", insumoId: "sobre", qty: 3 },
      { ref: "b", insumoId: "kit", qty: 1 },
      { ref: "b", insumoId: "sobre", qty: 1 },
    ]);
  });

  it("ciclo no cuelga", () => {
    const combos: ComponenteCombo[] = [
      { comboProductId: "A", componentProductId: "B", quantity: 1 },
      { comboProductId: "B", componentProductId: "A", quantity: 1 },
    ];
    const out = expandirConsumo([linea("A", 1)], [r("A", "kit"), r("B", "sobre")], combos, validos);
    expect(out.length).toBeGreaterThan(0);
    for (const c of out) expect(Number.isFinite(c.qty)).toBe(true);
  });
});
