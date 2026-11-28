import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildCanjeSlotPlan } from "@/lib/preventa-canjeable/preventa-canje-slots";
import {
  beneficiosDeLaCompra,
  cantidadesAQuery,
  cantidadesDeQuery,
  pedidoDeLaCompra,
  readProductDesignsFromSnapshot,
  totalEstimado,
  validarDisenosDelPedido,
  type ProductoDeCompra,
} from "./compra-directa";

const digital: ProductoDeCompra = {
  key: "digital",
  kind: "DIGITAL",
  productId: null,
  name: "Copia digital",
  size: null,
  finish: null,
  unitPriceArs: 20000,
  photosPerUnit: 1,
  templateId: null,
};
const impresa: ProductoDeCompra = {
  key: "p585",
  kind: "PHYSICAL",
  productId: 585,
  name: "Foto impresa",
  size: "15x21 cm",
  finish: "Mate",
  unitPriceArs: 23000,
  photosPerUnit: 1,
  templateId: null,
};
const librito: ProductoDeCompra = {
  key: "p586",
  kind: "PHYSICAL",
  productId: 586,
  name: "Librito escolar",
  size: "Librito",
  finish: "Mate",
  unitPriceArs: 46999,
  photosPerUnit: 2,
  templateId: "tpl",
  photoInputs: [
    { label: "Tapa", role: null },
    { label: "Contratapa", role: null },
  ],
};
const productos = [digital, impresa, librito];

describe("compra directa", () => {
  it("la elección viaja en la URL y vuelve igual", () => {
    const q = cantidadesAQuery({ digital: 2, p586: 1, p585: 0 });
    assert.equal(q, "digital.2,p586.1");
    assert.deepEqual(cantidadesDeQuery(q, productos), { digital: 2, p586: 1 });
    // Productos que no son del álbum o cantidades raras se ignoran.
    assert.deepEqual(cantidadesDeQuery("p999.3,digital.-1,p585.abc,p586.50", productos), { p586: 10 });
  });

  it("suma el total con los precios finales", () => {
    assert.equal(totalEstimado(productos, { digital: 1, p585: 1, p586: 1 }), 20000 + 23000 + 46999);
  });

  it("el librito pide sus lugares primero, con el nombre de cada uno", () => {
    const plan = buildCanjeSlotPlan(beneficiosDeLaCompra(productos, { digital: 1, p586: 1 }));
    assert.equal(plan.slots.length, 3);
    assert.deepEqual(
      plan.slots.map((s) => [s.benefitKey, s.label ?? null]),
      [
        ["p586", "Tapa"],
        ["p586", "Contratapa"],
        ["digital", null],
      ]
    );
  });

  it("arma un ítem por copia y un ítem + diseño por librito", () => {
    const plan = buildCanjeSlotPlan(beneficiosDeLaCompra(productos, { p586: 2, p585: 1 }));
    const filled = [10, 11, 12, 13, 14];
    const { items, productDesigns } = pedidoDeLaCompra(productos, plan, filled, { 1: { zoom: 1.5, x: 0.2, y: 0 } });
    assert.deepEqual(
      items.map((i) => [i.fileKey, i.productId, i.quantity]),
      [
        ["photo:10", 586, 1],
        ["photo:12", 586, 1],
        ["photo:14", 585, 1],
      ]
    );
    assert.deepEqual(productDesigns, [
      { productId: 586, photoIds: [10, 11], crops: [null, { zoom: 1.5, x: 0.2, y: 0 }] },
      { productId: 586, photoIds: [12, 13] },
    ]);
  });

  describe("validación en el servidor", () => {
    const base = {
      albumPhotoIds: new Set([10, 11, 12]),
      plantillas: new Map([[586, { templateId: "tpl", photoCount: 2 }]]),
      alumno: { nombre: "Juana", apellido: "Pérez", curso: "6° Grado A" },
    };
    const itemLibrito = { photoId: 10, productId: 586, quantity: 1, tipo: "impresa" as const };

    it("sin libritos no cambia nada", () => {
      assert.deepEqual(validarDisenosDelPedido({ ...base, raw: undefined, items: [] }), { ok: true, designs: [] });
    });

    it("acepta un librito cobrado sobre su tapa", () => {
      const r = validarDisenosDelPedido({ ...base, raw: [{ productId: 586, photoIds: [10, 11] }], items: [itemLibrito] });
      assert.equal(r.ok, true);
      if (r.ok) {
        assert.equal(r.designs[0]!.templateId, "tpl");
        assert.deepEqual(r.designs[0]!.alumno, base.alumno);
      }
    });

    it("rechaza fotos de más o de menos, repetidas o de otro álbum", () => {
      for (const photoIds of [[10], [10, 11, 12], [10, 10], [10, 99]]) {
        const r = validarDisenosDelPedido({ ...base, raw: [{ productId: 586, photoIds }], items: [itemLibrito] });
        assert.equal(r.ok, false, JSON.stringify(photoIds));
      }
    });

    it("rechaza un producto sin plantilla", () => {
      const r = validarDisenosDelPedido({ ...base, raw: [{ productId: 585, photoIds: [10, 11] }], items: [itemLibrito] });
      assert.equal(r.ok, false);
    });

    it("rechaza libritos que no coinciden con lo cobrado", () => {
      const sinCobrar = validarDisenosDelPedido({ ...base, raw: [{ productId: 586, photoIds: [10, 11] }], items: [] });
      assert.equal(sinCobrar.ok, false);
      const otraTapa = validarDisenosDelPedido({
        ...base,
        raw: [{ productId: 586, photoIds: [11, 10] }],
        items: [itemLibrito],
      });
      assert.equal(otraTapa.ok, false);
    });

    it("pide el nombre del alumno", () => {
      const r = validarDisenosDelPedido({ ...base, alumno: null, raw: [{ productId: 586, photoIds: [10, 11] }], items: [itemLibrito] });
      assert.equal(r.ok, false);
    });

    it("lo guardado se vuelve a leer igual", () => {
      const r = validarDisenosDelPedido({
        ...base,
        raw: [{ productId: 586, photoIds: [10, 11], crops: [{ zoom: 2, x: 0.5, y: -0.5 }] }],
        items: [itemLibrito],
      });
      assert.ok(r.ok);
      if (!r.ok) return;
      assert.deepEqual(readProductDesignsFromSnapshot({ productDesignsV1: r.designs }), r.designs);
      assert.deepEqual(readProductDesignsFromSnapshot({}), []);
    });
  });
});
