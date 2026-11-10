import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decidirPlanB } from "./plan-b-decidir";
import { bloqueaCheckoutPro, cobroPilotoEnCurso, marcarSnapshotPiloto, type EstadoPiloto } from "./snapshot";
import { prepararCobro } from "./cobro";

const marca = (estado: EstadoPiloto) => ({ v: 1 as const, estado });

describe("plan B: ¿puede pasar a Checkout Pro?", () => {
  it("sí, un pedido sin pagar con la marca PENDIENTE", () => {
    assert.equal(decidirPlanB({ estadoPedido: "PENDING", marca: marca("PENDIENTE") }), "pasar");
    assert.equal(decidirPlanB({ estadoPedido: "FAILED", marca: marca("PENDIENTE") }), "pasar");
  });

  it("ya elegido: se reabre el mismo cobro de Mercado Pago", () => {
    assert.equal(decidirPlanB({ estadoPedido: "PENDING", marca: marca("CHECKOUT_PRO") }), "ya_elegido");
  });

  for (const estado of ["COBRANDO", "EN_REVISION", "ACREDITADA", "PAGADO"] as const) {
    it(`no, si el cobro con tarjeta está ${estado}: podría cobrarse dos veces`, () => {
      assert.equal(decidirPlanB({ estadoPedido: "PENDING", marca: marca(estado) }), "cobro_en_curso");
    });
  }

  it("no, si el pedido ya está pagado (aunque la marca diga PENDIENTE)", () => {
    assert.equal(decidirPlanB({ estadoPedido: "PAID", marca: marca("PENDIENTE") }), "ya_pagado");
    assert.equal(decidirPlanB({ estadoPedido: "REFUNDED", marca: marca("CHECKOUT_PRO") }), "ya_pagado");
  });

  it("no, si el pedido no es del piloto", () => {
    assert.equal(decidirPlanB({ estadoPedido: "PENDING", marca: null }), "no_es_piloto");
  });
});

describe("plan B: guardas de Checkout Pro", () => {
  it("un pedido sin marca no se bloquea", () => {
    assert.equal(bloqueaCheckoutPro({ total: 1 }), false);
    assert.equal(bloqueaCheckoutPro(null), false);
  });

  it("un pedido del piloto sólo admite Checkout Pro si eligió el plan B", () => {
    assert.equal(bloqueaCheckoutPro(marcarSnapshotPiloto({}, { estado: "PENDIENTE" })), true);
    assert.equal(bloqueaCheckoutPro(marcarSnapshotPiloto({}, { estado: "COBRANDO" })), true);
    assert.equal(bloqueaCheckoutPro(marcarSnapshotPiloto({}, { estado: "CHECKOUT_PRO" })), false);
  });

  it("un cobro con tarjeta en curso o hecho no recibe «completá tu pago»", () => {
    assert.equal(cobroPilotoEnCurso(marcarSnapshotPiloto({}, { estado: "COBRANDO" })), true);
    assert.equal(cobroPilotoEnCurso(marcarSnapshotPiloto({}, { estado: "EN_REVISION" })), true);
    assert.equal(cobroPilotoEnCurso(marcarSnapshotPiloto({}, { estado: "PENDIENTE" })), false);
    assert.equal(cobroPilotoEnCurso(marcarSnapshotPiloto({}, { estado: "CHECKOUT_PRO" })), false);
    assert.equal(cobroPilotoEnCurso({}), false);
  });

  it("la tarjeta ya no cobra un pedido que pasó a Checkout Pro", () => {
    const r = prepararCobro({
      estadoPedido: "PENDING",
      marca: marca("CHECKOUT_PRO"),
      totalPesos: 1000,
      feePesos: 100,
      basePesos: 900,
      porcentajeOrganizador: 0,
      receivers: { fotografo: "aaa", referidor: null, organizador: null, referidorOrganizador: null },
      payerEmail: "comprador@ejemplo.com",
      correosReceptores: [],
    });
    assert.deepEqual(r, { ok: false, codigo: "ELIGIO_MERCADO_PAGO" });
  });
});
