import { describe, expect, it } from "vitest";
import { proyectosDelPedido, type ItemParaProyectos, type ReglaProyecto } from "./reglas";

const item = (productId: string | null, cantidad = 1, opcional = false): ItemParaProyectos => ({ productId, cantidad, opcional });
const regla = (productId: string, circuitId: string, extra: Partial<ReglaProyecto> = {}): ReglaProyecto => ({
  productId, circuitId, ownerUserId: null, daysFromEvent: 0, nameTemplate: null, ...extra,
});

describe("proyectosDelPedido", () => {
  it("sin reglas, nada", () => {
    expect(proyectosDelPedido([item("p1")], [], [])).toEqual([]);
  });

  it("un proyecto por regla; la cantidad no multiplica", () => {
    const r = proyectosDelPedido([item("p1", 5)], [regla("p1", "c1", { ownerUserId: 7, daysFromEvent: 30, nameTemplate: "{producto}" })], []);
    expect(r).toEqual([{ pedidoItemIndex: 0, productId: "p1", circuitId: "c1", ownerUserId: 7, daysFromEvent: 30, nameTemplate: "{producto}" }]);
  });

  it("varias reglas del mismo producto, en el orden recibido", () => {
    const r = proyectosDelPedido([item("p1")], [regla("p1", "c1"), regla("p1", "c2")], []);
    expect(r.map((x) => x.circuitId)).toEqual(["c1", "c2"]);
  });

  it("ignora texto libre, opcionales y cantidad cero; el índice es el del ítem original", () => {
    const r = proyectosDelPedido(
      [item(null), item("p1", 1, true), item("p1", 0), item("p1", 2), item("p1", 1)],
      [regla("p1", "c1")],
      [],
    );
    expect(r.map((x) => x.pedidoItemIndex)).toEqual([3, 4]);
  });

  it("dos ítems del mismo producto dan dos proyectos (índices distintos)", () => {
    expect(proyectosDelPedido([item("p1"), item("p1")], [regla("p1", "c1")], [])).toHaveLength(2);
  });

  it("un combo suma las reglas de sus componentes además de las propias", () => {
    const r = proyectosDelPedido(
      [item("combo")],
      [regla("combo", "cc"), regla("a", "ca", { nameTemplate: "  " }), regla("b", "cb")],
      [
        { comboProductId: "combo", componentProductId: "a", quantity: 1 },
        { comboProductId: "combo", componentProductId: "b", quantity: 3 },
      ],
    );
    expect(r.map((x) => [x.pedidoItemIndex, x.productId, x.circuitId, x.nameTemplate])).toEqual([
      [0, "combo", "cc", null],
      [0, "a", "ca", null],
      [0, "b", "cb", null],
    ]);
  });

  it("combos anidados; un ciclo se corta", () => {
    const r = proyectosDelPedido(
      [item("c1")],
      [regla("c1", "x1"), regla("c2", "x2"), regla("p", "xp")],
      [
        { comboProductId: "c1", componentProductId: "c2", quantity: 1 },
        { comboProductId: "c2", componentProductId: "p", quantity: 1 },
        { comboProductId: "c2", componentProductId: "c1", quantity: 1 },
      ],
    );
    expect(r.map((x) => x.circuitId)).toEqual(["x1", "x2", "xp"]);
  });

  it("componentes de cantidad cero no cuentan", () => {
    expect(proyectosDelPedido([item("combo")], [regla("a", "ca")], [{ comboProductId: "combo", componentProductId: "a", quantity: 0 }])).toEqual([]);
  });

  it("no repite el mismo flujo dentro de un ítem (único del SQL), pero sí entre ítems", () => {
    const r = proyectosDelPedido(
      [item("combo"), item("a")],
      [regla("combo", "c"), regla("a", "c")],
      [{ comboProductId: "combo", componentProductId: "a", quantity: 1 }],
    );
    expect(r.map((x) => [x.pedidoItemIndex, x.productId])).toEqual([[0, "combo"], [1, "a"]]);
  });
});
