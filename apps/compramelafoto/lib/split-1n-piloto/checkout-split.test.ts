import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { idOrdenDelAviso } from "./aviso";
import { armarOrdenCheckoutSplit, decidirOrdenCheckoutSplit } from "./checkout-split";
import { prepararCobro } from "./cobro";
import { decidirPlanB } from "./plan-b-decidir";
import { bloqueaCheckoutPro, cobroPilotoEnCurso, marcarSnapshotPiloto } from "./snapshot";

function cobroDePrueba() {
  const r = prepararCobro({
    estadoPedido: "PENDING",
    marca: { v: 1, estado: "PENDIENTE" },
    totalPesos: 3450,
    feePesos: 450,
    basePesos: 3000,
    porcentajeOrganizador: 20,
    receivers: { fotografo: "R-FOTO", referidor: "R-REF", organizador: "R-ORG", referidorOrganizador: null },
    payerEmail: "comprador@ejemplo.com",
    correosReceptores: [],
  });
  assert.equal(r.ok, true);
  if (!r.ok) throw new Error("cobro");
  return r;
}

describe("Checkout Pro con reparto: la orden", () => {
  const cobro = cobroDePrueba();
  const orden = armarOrdenCheckoutSplit({
    pedidoId: 4321,
    cobro,
    ownerUserId: "97484805",
    titulo: "Fotos de «Maratón»",
    payerEmail: "comprador@ejemplo.com",
    baseUrl: "https://www.compramelafoto.com/",
  });

  it("es una orden de Checkout Pro: online, manual, sin transacciones ni tarjeta", () => {
    assert.equal(orden.type, "online");
    assert.equal(orden.processing_mode, "manual");
    assert.equal("transactions" in orden, false);
    assert.equal(orden.expiration_time, "P1D");
  });

  it("lleva la referencia del pedido: la confirma lo mismo que confirma la tarjeta", () => {
    assert.equal(orden.external_reference, "clf-album-order-4321");
  });

  it("reparte exactamente lo que reparte la tarjeta, con la plataforma como owner", () => {
    assert.equal(orden.total_amount, "3450.00");
    const suma = orden.splits.reduce((s, x) => s + Math.round(Number(x.amount) * 100), 0);
    assert.equal(suma, 345000);
    const owner = orden.splits.filter((x) => x.receiver_type === "owner");
    assert.equal(owner.length, 1);
    assert.equal(owner[0].receiver_id, "97484805");
    assert.equal(owner[0].amount, `${cobro.reparto.plataforma}.00`);
    const porReceptor = new Map(orden.splits.map((x) => [x.receiver_id, x.amount]));
    assert.equal(porReceptor.get("R-FOTO"), `${cobro.reparto.fotografo}.00`);
    assert.equal(porReceptor.get("R-ORG"), `${cobro.reparto.organizador}.00`);
    assert.equal(porReceptor.get("R-REF"), `${cobro.reparto.referidor}.00`);
    assert.deepEqual(orden.config.split_rules, { amount_type: "fixed" });
  });

  it("el ítem suma el total y el comprador vuelve a la página de pago del pedido", () => {
    assert.deepEqual(orden.items, [{ title: "Fotos de «Maratón»", unit_price: "3450.00", quantity: 1 }]);
    assert.equal(orden.config.online.success_url, "https://www.compramelafoto.com/pagar/4321");
    assert.equal(orden.config.online.failure_url, "https://www.compramelafoto.com/pagar/4321");
    assert.equal(orden.config.online.pending_url, "https://www.compramelafoto.com/pagar/4321");
    assert.equal(orden.config.online.auto_return, "approved");
    assert.deepEqual(orden.payer, { email: "comprador@ejemplo.com" });
  });
});

describe("Checkout Pro con reparto: ¿se reutiliza la orden vigente?", () => {
  it("se reutiliza mientras no terminó", () => {
    assert.equal(decidirOrdenCheckoutSplit("created"), "reusar");
    assert.equal(decidirOrdenCheckoutSplit("processing"), "reusar");
    assert.equal(decidirOrdenCheckoutSplit("action_required"), "reusar");
  });
  it("pagada: se confirma, no se cobra otra vez", () => {
    assert.equal(decidirOrdenCheckoutSplit("processed"), "confirmar");
  });
  it("vencida, cancelada o rechazada: se puede crear otra", () => {
    assert.equal(decidirOrdenCheckoutSplit("canceled"), "nueva");
    assert.equal(decidirOrdenCheckoutSplit("expired"), "nueva");
    assert.equal(decidirOrdenCheckoutSplit("failed"), "nueva");
  });
  it("devuelta o desconocida: ni se reutiliza ni habilita otra", () => {
    assert.equal(decidirOrdenCheckoutSplit(null), "verificar");
    assert.equal(decidirOrdenCheckoutSplit("refunded"), "verificar");
    assert.equal(decidirOrdenCheckoutSplit("algo_nuevo"), "verificar");
  });
});

describe("Checkout Pro con reparto: guardas", () => {
  const split = marcarSnapshotPiloto({}, { estado: "CHECKOUT_SPLIT", providerOrderId: "ORD1" });

  it("la tarjeta no cobra un pedido con una orden de Checkout Pro con reparto", () => {
    const r = prepararCobro({
      estadoPedido: "PENDING",
      marca: { v: 1, estado: "CHECKOUT_SPLIT" },
      totalPesos: 1000,
      feePesos: 100,
      basePesos: 900,
      receivers: { fotografo: "a", referidor: null },
      payerEmail: "c@ejemplo.com",
      correosReceptores: [],
    });
    assert.deepEqual(r, { ok: false, codigo: "ELIGIO_MERCADO_PAGO" });
  });

  it("tampoco el Checkout Pro de siempre, ni el aviso de pedido abandonado", () => {
    assert.equal(bloqueaCheckoutPro(split), true);
    assert.equal(cobroPilotoEnCurso(split), true);
  });

  it("el plan B de siempre no lo pasa a Checkout Pro 1:1", () => {
    assert.equal(decidirPlanB({ estadoPedido: "PENDING", marca: { v: 1, estado: "CHECKOUT_SPLIT" } }), "split_en_curso");
  });

  it("el aviso de Mercado Pago de una orden de Checkout Pro también se mira", () => {
    assert.equal(idOrdenDelAviso({ enabled: true, type: "orders_v2", dataId: "ORD1" }), "ORD1");
    assert.equal(idOrdenDelAviso({ enabled: true, type: "order", dataId: "ORD1" }), "ORD1");
    assert.equal(idOrdenDelAviso({ enabled: true, type: "payment", dataId: "1" }), null);
  });
});
