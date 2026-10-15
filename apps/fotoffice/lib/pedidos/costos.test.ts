import { describe, expect, it } from "vitest";
import { cuentasDesdeCostos, type CostoPlantillaParaCuentas, type ItemParaCostos } from "./costos";

const item = (productId: string | null, cantidad = 1, extra: Partial<ItemParaCostos> = {}): ItemParaCostos => ({
  productId,
  cantidad,
  opcional: false,
  ...extra,
});

const costo = (id: string, productId: string, amountArs: CostoPlantillaParaCuentas["amountArs"], extra: Partial<CostoPlantillaParaCuentas> = {}): CostoPlantillaParaCuentas => ({
  id,
  productId,
  supplierClientId: null,
  concept: `Costo ${id}`,
  amountArs,
  perUnit: false,
  daysFromEvent: 0,
  ...extra,
});

describe("cuentasDesdeCostos", () => {
  it("sin costos, lista vacía", () => {
    expect(cuentasDesdeCostos({ items: [item("p1", 2)], costos: [], combos: [], fechaEvento: "2026-12-05" })).toEqual([]);
  });

  it("un costo fijo va una vez por ítem; uno por unidad, por la cantidad", () => {
    const r = cuentasDesdeCostos({
      items: [item("p1", 3)],
      costos: [costo("fijo", "p1", "1500.50"), costo("unidad", "p1", 200, { perUnit: true, supplierClientId: "prov" })],
      combos: [],
      fechaEvento: "2026-12-05",
    });
    expect(r).toEqual([
      { costoPlantillaId: "fijo", supplierClientId: null, concept: "Costo fijo", amountArs: 1500.5, dueDate: "2026-12-05" },
      { costoPlantillaId: "unidad", supplierClientId: "prov", concept: "Costo unidad", amountArs: 600, dueDate: "2026-12-05" },
    ]);
  });

  it("calcula en centavos: 0,10 × 3 da 0,30 exacto", () => {
    const r = cuentasDesdeCostos({ items: [item("p1", 3)], costos: [costo("c", "p1", "0.10", { perUnit: true })], combos: [], fechaEvento: null });
    expect(r[0]!.amountArs).toBe(0.3);
  });

  it("acepta un Decimal de Prisma (cualquier cosa con toString)", () => {
    const decimal = { toString: () => "1234.56" };
    const r = cuentasDesdeCostos({ items: [item("p1")], costos: [costo("c", "p1", decimal)], combos: [], fechaEvento: null });
    expect(r[0]!.amountArs).toBe(1234.56);
  });

  it("el vencimiento es la fecha del evento más los días, cruzando meses y años", () => {
    const r = cuentasDesdeCostos({
      items: [item("p1")],
      costos: [
        costo("antes", "p1", 10, { daysFromEvent: -10 }),
        costo("despues", "p1", 10, { daysFromEvent: 30 }),
      ],
      combos: [],
      fechaEvento: "2026-12-05",
    });
    expect(r.map((c) => c.dueDate)).toEqual(["2026-11-25", "2027-01-04"]);
  });

  it("acepta la fecha del evento como Date de una columna DATE", () => {
    const r = cuentasDesdeCostos({
      items: [item("p1")],
      costos: [costo("c", "p1", 10, { daysFromEvent: 1 })],
      combos: [],
      fechaEvento: new Date("2026-02-28T00:00:00.000Z"),
    });
    expect(r[0]!.dueDate).toBe("2026-03-01");
  });

  it("sin fecha de evento (o con una inválida), el vencimiento es null", () => {
    for (const fechaEvento of [null, "2026-02-30", "no"]) {
      const r = cuentasDesdeCostos({ items: [item("p1")], costos: [costo("c", "p1", 10, { daysFromEvent: 5 })], combos: [], fechaEvento });
      expect(r[0]!.dueDate).toBeNull();
    }
  });

  it("los ítems de texto libre y los opcionales no generan cuentas", () => {
    const r = cuentasDesdeCostos({
      items: [item(null, 1), item("p1", 1, { opcional: true })],
      costos: [costo("c", "p1", 100)],
      combos: [],
      fechaEvento: null,
    });
    expect(r).toEqual([]);
  });

  it("el concepto lleva el nombre del producto: el del mapa o, si no, el del ítem", () => {
    const conMapa = cuentasDesdeCostos({
      items: [item("p1", 1, { nombre: "Nombre del renglón" })],
      costos: [costo("c", "p1", 100, { concept: "Impresión" })],
      combos: [],
      fechaEvento: null,
      nombres: new Map([["p1", "Álbum 30×30"]]),
    });
    expect(conMapa[0]!.concept).toBe("Impresión · Álbum 30×30");
    const sinMapa = cuentasDesdeCostos({
      items: [item("p1", 1, { nombre: "Nombre del renglón" })],
      costos: [costo("c", "p1", 100, { concept: "Impresión" })],
      combos: [],
      fechaEvento: null,
    });
    expect(sinMapa[0]!.concept).toBe("Impresión · Nombre del renglón");
    const sinNombre = cuentasDesdeCostos({ items: [item("p1")], costos: [costo("c", "p1", 100, { concept: "Impresión" })], combos: [], fechaEvento: null });
    expect(sinNombre[0]!.concept).toBe("Impresión");
  });

  it("un combo suma sus propios costos y los de cada componente × la cantidad del componente", () => {
    const r = cuentasDesdeCostos({
      items: [item("combo", 2)],
      costos: [
        costo("propio", "combo", 50),
        costo("album-unidad", "album", 100, { perUnit: true, concept: "Imprenta" }),
        costo("album-fijo", "album", 30, { concept: "Diseño" }),
        costo("cuadro", "cuadro", 20, { perUnit: true, concept: "Marco" }),
      ],
      combos: [
        { comboProductId: "combo", componentProductId: "album", quantity: 1 },
        { comboProductId: "combo", componentProductId: "cuadro", quantity: 3 },
      ],
      fechaEvento: null,
      nombres: new Map([["combo", "Combo boda"], ["album", "Álbum"], ["cuadro", "Cuadro"]]),
    });
    expect(r.map((c) => [c.costoPlantillaId, c.concept, c.amountArs])).toEqual([
      ["propio", "Costo propio · Combo boda", 50],
      ["album-unidad", "Imprenta · Álbum", 200],
      ["album-fijo", "Diseño · Álbum", 30],
      ["cuadro", "Marco · Cuadro", 120],
    ]);
  });

  it("baja a combos anidados y corta un ciclo sin colgarse", () => {
    const r = cuentasDesdeCostos({
      items: [item("a", 1)],
      costos: [costo("cb", "b", 10, { perUnit: true }), costo("cc", "c", 1, { perUnit: true })],
      combos: [
        { comboProductId: "a", componentProductId: "b", quantity: 2 },
        { comboProductId: "b", componentProductId: "c", quantity: 5 },
        { comboProductId: "c", componentProductId: "a", quantity: 1 },
      ],
      fechaEvento: null,
    });
    expect(r.map((c) => [c.costoPlantillaId, c.amountArs])).toEqual([
      ["cb", 20],
      ["cc", 10],
    ]);
  });

  it("no genera cuentas de importe cero", () => {
    const r = cuentasDesdeCostos({ items: [item("p1", 4)], costos: [costo("c", "p1", 0, { perUnit: true })], combos: [], fechaEvento: null });
    expect(r).toEqual([]);
  });
});
