import { describe, expect, it } from "vitest";
import { citasDelPedido, citasQueFaltan, type ItemParaCitas, type ReglaCita } from "./reglas";

const item = (productId: string | null, cantidad = 1, opcional = false): ItemParaCitas => ({ productId, cantidad, opcional });
const regla = (id: string, productId: string, extra: Partial<ReglaCita> = {}): ReglaCita => ({
  id, productId, typeId: null, title: null, daysFromEvent: 0, startTime: null, durationMinutes: 60, ownerUserId: null, ...extra,
});

describe("citasDelPedido", () => {
  it("sin reglas, nada", () => expect(citasDelPedido([item("p1")], [], [])).toEqual([]));

  it("una cita por regla, con su reglaId; la cantidad no multiplica", () => {
    const r = citasDelPedido([item("p1", 5)], [regla("r1", "p1", { typeId: "t", title: "Prueba", daysFromEvent: -7, startTime: "10:00", durationMinutes: 30, ownerUserId: 4 })], []);
    expect(r).toEqual([
      { pedidoItemIndex: 0, reglaId: "r1", productId: "p1", typeId: "t", title: "Prueba", daysFromEvent: -7, startTime: "10:00", durationMinutes: 30, ownerUserId: 4 },
    ]);
  });

  it("ignora texto libre, opcionales y cantidad cero; el índice es el del ítem original", () => {
    const r = citasDelPedido([item(null), item("p1", 1, true), item("p1", 0), item("p1", 2), item("p1", 1)], [regla("r1", "p1")], []);
    expect(r.map((x) => x.pedidoItemIndex)).toEqual([3, 4]);
  });

  it("un combo suma las reglas de sus componentes, con el índice del combo", () => {
    const r = citasDelPedido(
      [item("combo")],
      [regla("r1", "combo"), regla("r2", "a"), regla("r3", "b")],
      [
        { comboProductId: "combo", componentProductId: "a", quantity: 1 },
        { comboProductId: "a", componentProductId: "b", quantity: 2 },
      ],
    );
    expect(r.map((x) => [x.reglaId, x.productId, x.pedidoItemIndex])).toEqual([["r1", "combo", 0], ["r2", "a", 0], ["r3", "b", 0]]);
  });

  it("un ciclo o un componente repetido no duplica la regla", () => {
    const r = citasDelPedido(
      [item("c")],
      [regla("r1", "a")],
      [
        { comboProductId: "c", componentProductId: "a", quantity: 1 },
        { comboProductId: "c", componentProductId: "a", quantity: 1 },
        { comboProductId: "a", componentProductId: "c", quantity: 1 },
      ],
    );
    expect(r).toHaveLength(1);
  });

  it("componentes de cantidad cero no suman; valores inválidos toman los de omisión", () => {
    const r = citasDelPedido(
      [item("c")],
      [regla("r1", "a"), regla("r2", "c", { durationMinutes: Number.NaN, daysFromEvent: 1.5, title: "  " })],
      [{ comboProductId: "c", componentProductId: "a", quantity: 0 }],
    );
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ reglaId: "r2", durationMinutes: 60, daysFromEvent: 0, title: null });
  });

  it("citasQueFaltan filtra las ya creadas", () => {
    const deseadas = citasDelPedido([item("p1"), item("p1")], [regla("r1", "p1")], []);
    expect(citasQueFaltan(deseadas, [{ pedidoItemIndex: 0, reglaId: "r1" }, { pedidoItemIndex: null, reglaId: null }]).map((x) => x.pedidoItemIndex)).toEqual([1]);
  });
});
