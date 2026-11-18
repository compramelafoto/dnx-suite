import assert from "node:assert/strict";
import { test } from "node:test";

import {
  armarCobroGrupo,
  decidirFinalizacionGrupo,
  grupoIdDesdeReferenciaPreventa,
  mismosPedidos,
  referenciaEsDelPedido,
  referenciaGrupoPreventa,
  validarPedidosParaAgrupar,
  type PedidoDelGrupo,
  type PedidoParaAgrupar,
} from "./reglas";
import {
  finalizarGrupoConDeps,
  procesarAvisoGrupoConDeps,
  revertirGrupoConDeps,
  type DepsFinalizarGrupo,
  type DepsRevertirGrupo,
  type GrupoGuardado,
  type PagoLeido,
} from "./orquestar";
import { armarComprobanteGrupo } from "./correo-grupo";

const GRUPO = "3f2b9c1e-8a4d-4f6b-9e2a-1c5d7e9f0a12";
const REF = referenciaGrupoPreventa(GRUPO);
const ahora = new Date("2026-11-18T15:00:00.000Z");

// El caso real del 18/11/2026: álbum 1283, Libro escolar 25.000 + Pack 2 20.000.
function pedido(p: Partial<PedidoParaAgrupar> & { id: number }): PedidoParaAgrupar {
  return {
    albumId: 1283,
    buyerEmail: "familia@example.com",
    status: "PENDING",
    origin: "PREVENTA_PACK",
    checkoutPaymentSource: "MERCADO_PAGO",
    isTest: false,
    currency: "ARS",
    totalCents: 25000,
    createdAt: new Date(ahora.getTime() - 60_000),
    bloqueaCheckoutPro: false,
    ...p,
  };
}
const libro = pedido({ id: 4701, totalCents: 25000 });
const pack2 = pedido({ id: 4702, totalCents: 20000 });

// ---------------------------------------------------------------------------
// Referencia del pago
// ---------------------------------------------------------------------------

test("referencia del grupo: ida y vuelta, y nada que no sea un grupo", () => {
  assert.equal(REF, `clf-preventa-grupo-${GRUPO}`);
  assert.equal(grupoIdDesdeReferenciaPreventa(REF), GRUPO);
  assert.equal(grupoIdDesdeReferenciaPreventa("4701"), null);
  assert.equal(grupoIdDesdeReferenciaPreventa("clf-event-cart-" + GRUPO), null);
  assert.equal(grupoIdDesdeReferenciaPreventa("clf-preventa-grupo-no-es-uuid"), null);
  assert.equal(grupoIdDesdeReferenciaPreventa(null), null);
});

test("el pago es del pedido si es su número o el grupo que lo incluye", () => {
  const grupo = { id: GRUPO, orderIds: [4701, 4702] };
  assert.equal(referenciaEsDelPedido("4701", 4701), true);
  assert.equal(referenciaEsDelPedido(REF, 4701, grupo), true);
  assert.equal(referenciaEsDelPedido(REF, 4999, grupo), false, "pedido fuera del grupo");
  assert.equal(referenciaEsDelPedido(REF, 4701, null), false, "sin grupo no alcanza la referencia");
  assert.equal(
    referenciaEsDelPedido(referenciaGrupoPreventa("00000000-0000-4000-8000-000000000000"), 4701, grupo),
    false,
    "otro grupo",
  );
});

// ---------------------------------------------------------------------------
// Agrupado
// ---------------------------------------------------------------------------

test("libro escolar + pack 2 del mismo comprador se agrupan: total 45.000", () => {
  const r = validarPedidosParaAgrupar({
    orderIdsPedidos: [4702, 4701],
    pedidos: [libro, pack2],
    buyerEmail: "  Familia@Example.com ",
    ahora,
  });
  assert.deepEqual(r, { ok: true, orderIds: [4701, 4702], albumId: 1283, totalArs: 45000 });
});

test("no se agrupan: un solo pedido, otro álbum, otro comprador, ya pagado, prueba, cobro dividido, viejo", () => {
  const base = { buyerEmail: "familia@example.com", ahora };
  const casos: Array<[PedidoParaAgrupar[], number[], string]> = [
    [[libro], [4701, 4701], "pocos_pedidos"],
    [[libro], [4701, 4702], "pedido_inexistente"],
    [[libro, pedido({ id: 4702, albumId: 9 })], [4701, 4702], "albumes_distintos"],
    [[libro, pedido({ id: 4702, buyerEmail: "otra@example.com" })], [4701, 4702], "otro_comprador"],
    [[libro, pedido({ id: 4702, status: "PAID" })], [4701, 4702], "no_pagable"],
    [[libro, pedido({ id: 4702, origin: "STANDARD_CHECKOUT" })], [4701, 4702], "no_es_preventa"],
    [[libro, pedido({ id: 4702, isTest: true })], [4701, 4702], "prueba"],
    [[libro, pedido({ id: 4702, currency: "USD" })], [4701, 4702], "moneda"],
    [[libro, pedido({ id: 4702, bloqueaCheckoutPro: true })], [4701, 4702], "cobro_dividido"],
    [[libro, pedido({ id: 4702, totalCents: 0 })], [4701, 4702], "sin_monto"],
    [[libro, pedido({ id: 4702, createdAt: new Date(ahora.getTime() - 3 * 3600_000) })], [4701, 4702], "viejo"],
  ];
  for (const [pedidos, ids, motivo] of casos) {
    const r = validarPedidosParaAgrupar({ ...base, pedidos, orderIdsPedidos: ids });
    assert.equal(r.ok, false, motivo);
    if (!r.ok) assert.equal(r.motivo, motivo);
  }
});

test("un pedido FAILED (pago anterior rechazado) se puede volver a cobrar en el grupo", () => {
  const r = validarPedidosParaAgrupar({
    orderIdsPedidos: [4701, 4702],
    pedidos: [libro, pedido({ id: 4702, totalCents: 20000, status: "FAILED" })],
    buyerEmail: "familia@example.com",
    ahora,
  });
  assert.equal(r.ok, true);
});

test("mismo conjunto de pedidos sin importar el orden", () => {
  assert.equal(mismosPedidos([4702, 4701], [4701, 4702]), true);
  assert.equal(mismosPedidos([4701], [4701, 4702]), false);
  assert.equal(mismosPedidos([4701, 4703], [4701, 4702]), false);
});

test("la preferencia: un renglón por pack, total sumado y comisión sumada", () => {
  const cobro = armarCobroGrupo([
    { orderId: 4702, titulo: "Pack 2", totalArs: 20000, comisionArs: 2000 },
    { orderId: 4701, titulo: "Libro escolar", totalArs: 25000, comisionArs: 2500 },
  ]);
  assert.deepEqual(cobro.items, [
    { id: "ORD-ALBUM_ORDER-4701", title: "Libro escolar - Pedido #4701", unitPrice: 25000 },
    { id: "ORD-ALBUM_ORDER-4702", title: "Pack 2 - Pedido #4702", unitPrice: 20000 },
  ]);
  assert.equal(cobro.total, 45000);
  assert.equal(cobro.marketplaceFee, 4500);
  assert.match(cobro.titulo, /2 packs/);
});

test("la comisión sumada nunca supera lo cobrado", () => {
  const cobro = armarCobroGrupo([
    { orderId: 1, titulo: "A", totalArs: 100, comisionArs: 90 },
    { orderId: 2, titulo: " ", totalArs: 100, comisionArs: 150 },
  ]);
  assert.equal(cobro.marketplaceFee, 200);
  assert.equal(cobro.items[1].title, "Pack de preventa - Pedido #2");
});

// ---------------------------------------------------------------------------
// Decisión ante un pago aprobado
// ---------------------------------------------------------------------------

const pendientes: PedidoDelGrupo[] = [
  { id: 4701, status: "PENDING", mpPaymentId: null, totalCents: 25000 },
  { id: 4702, status: "PENDING", mpPaymentId: null, totalCents: 20000 },
];
const pagoOk = { externalReference: REF, status: "approved", monto: 45000, moneda: "ARS" };

test("pago aprobado por el total: se confirman los dos pedidos", () => {
  assert.deepEqual(
    decidirFinalizacionGrupo({ grupoId: GRUPO, orderIds: [4701, 4702], paymentId: "P1", pago: pagoOk, pedidos: pendientes }),
    { accion: "finalizar", aFinalizar: [4701, 4702], yaPagados: [] },
  );
});

test("pago por otro monto, otra referencia o no aprobado: no se toca ningún pedido", () => {
  const base = { grupoId: GRUPO, orderIds: [4701, 4702], paymentId: "P1", pedidos: pendientes };
  const motivo = (pago: typeof pagoOk) => {
    const d = decidirFinalizacionGrupo({ ...base, pago });
    return d.accion === "ignorar" ? d.motivo : "finalizar";
  };
  assert.equal(motivo({ ...pagoOk, monto: 25000 }), "monto_distinto");
  assert.equal(motivo({ ...pagoOk, externalReference: "4701" }), "referencia_ajena");
  assert.equal(motivo({ ...pagoOk, status: "pending" }), "no_aprobado");
  assert.equal(motivo({ ...pagoOk, moneda: "USD" }), "moneda");
  const sinUno = decidirFinalizacionGrupo({ ...base, pago: pagoOk, pedidos: [pendientes[0]] });
  assert.equal(sinUno.accion === "ignorar" && sinUno.motivo, "pedidos_faltantes");
});

test("aviso repetido: el pedido ya pagado con este pago no se vuelve a finalizar", () => {
  const d = decidirFinalizacionGrupo({
    grupoId: GRUPO,
    orderIds: [4701, 4702],
    paymentId: "P1",
    pago: pagoOk,
    pedidos: [{ ...pendientes[0], status: "PAID", mpPaymentId: "P1" }, pendientes[1]],
  });
  assert.deepEqual(d, { accion: "finalizar", aFinalizar: [4702], yaPagados: [4701] });
});

test("pedido pagado con OTRO pago: igual pasa por la finalización (ahí se avisa el cobro duplicado)", () => {
  const d = decidirFinalizacionGrupo({
    grupoId: GRUPO,
    orderIds: [4701, 4702],
    paymentId: "P2",
    pago: pagoOk,
    pedidos: [{ ...pendientes[0], status: "PAID", mpPaymentId: "P1" }, pendientes[1]],
  });
  assert.deepEqual(d, { accion: "finalizar", aFinalizar: [4701, 4702], yaPagados: [] });
});

// ---------------------------------------------------------------------------
// Finalización (lo que corre el webhook)
// ---------------------------------------------------------------------------

function fakeFinalizar(opts?: { falla?: number; pago?: Partial<PagoLeido>; duplicado?: number }) {
  const pedidos = new Map<number, PedidoDelGrupo>(pendientes.map((p) => [p.id, { ...p }]));
  const grupo: GrupoGuardado = { id: GRUPO, orderIds: [4701, 4702], status: "PENDING", mpPaymentId: null };
  const llamadas = { finalizar: [] as number[], comprobantes: 0, grupoPagado: 0 };
  const deps: DepsFinalizarGrupo = {
    cargarGrupo: async (id) => (id === GRUPO ? grupo : null),
    cargarPedidos: async (ids) => ids.map((id) => pedidos.get(id)).filter((p): p is PedidoDelGrupo => !!p).map((p) => ({ ...p })),
    leerPago: async () => ({ ...pagoOk, ...opts?.pago }),
    finalizarPedido: async (orderId, paymentId, g) => {
      assert.equal(g.id, GRUPO);
      llamadas.finalizar.push(orderId);
      if (orderId === opts?.falla) return { ok: false, error: "preventa_pack_not_found" };
      if (orderId === opts?.duplicado) return { ok: true, skipped: "duplicate_payment" };
      pedidos.set(orderId, { ...pedidos.get(orderId)!, status: "PAID", mpPaymentId: paymentId });
      return { ok: true };
    },
    marcarGrupoPagado: async () => {
      llamadas.grupoPagado += 1;
      grupo.status = "PAID";
    },
    encolarComprobante: async () => {
      llamadas.comprobantes += 1;
    },
  };
  return { deps, llamadas, pedidos };
}

test("webhook aprobado: confirma los dos pedidos y manda UN solo comprobante", async () => {
  const { deps, llamadas, pedidos } = fakeFinalizar();
  const r = await finalizarGrupoConDeps(deps, { grupoId: GRUPO, paymentId: "P1" });
  assert.deepEqual(r, { ok: true, confirmados: [4701, 4702], yaPagados: [], fallidos: [], duplicados: [], grupoPagado: true });
  assert.deepEqual(llamadas, { finalizar: [4701, 4702], comprobantes: 1, grupoPagado: 1 });
  assert.equal(pedidos.get(4701)!.mpPaymentId, "P1");
  assert.equal(pedidos.get(4702)!.mpPaymentId, "P1");
});

test("si un pedido falla, el otro igual se confirma y el grupo no se da por pagado (lo completa el reintento)", async () => {
  const { deps, llamadas } = fakeFinalizar({ falla: 4701 });
  const r = await finalizarGrupoConDeps(deps, { grupoId: GRUPO, paymentId: "P1" });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.deepEqual(r.confirmados, [4702]);
    assert.deepEqual(r.fallidos, [{ orderId: 4701, error: "preventa_pack_not_found" }]);
    assert.equal(r.grupoPagado, false);
  }
  assert.equal(llamadas.comprobantes, 0, "sin comprobante hasta que estén los dos");

  // Reintento (otro aviso o el cron): ahora sí.
  const { deps: deps2 } = fakeFinalizar();
  const r2 = await finalizarGrupoConDeps(deps2, { grupoId: GRUPO, paymentId: "P1" });
  assert.equal(r2.ok && r2.grupoPagado, true);
});

test("segundo aviso del mismo pago: no se finaliza nada de nuevo (el comprobante repite la clave del grupo)", async () => {
  const { deps, llamadas } = fakeFinalizar();
  await finalizarGrupoConDeps(deps, { grupoId: GRUPO, paymentId: "P1" });
  const r = await finalizarGrupoConDeps(deps, { grupoId: GRUPO, paymentId: "P1" });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.deepEqual(r.confirmados, []);
    assert.deepEqual(r.yaPagados, [4701, 4702]);
  }
  assert.deepEqual(llamadas.finalizar, [4701, 4702]);
  // El comprobante se encola de nuevo pero con la misma clave de idempotencia del grupo.
  assert.equal(llamadas.comprobantes, 2);
});

test("pago aprobado por otro monto: no se confirma ningún pedido", async () => {
  const { deps, llamadas } = fakeFinalizar({ pago: { monto: 20000 } });
  const r = await finalizarGrupoConDeps(deps, { grupoId: GRUPO, paymentId: "P1" });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error, "monto_distinto");
  assert.deepEqual(llamadas.finalizar, []);
});

test("cobro duplicado en un pedido: se informa aparte y el grupo no queda pagado con este pago", async () => {
  const { deps } = fakeFinalizar({ duplicado: 4701 });
  const r = await finalizarGrupoConDeps(deps, { grupoId: GRUPO, paymentId: "P1" });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.deepEqual(r.duplicados, [4701]);
    assert.equal(r.grupoPagado, false);
  }
});

test("grupo inexistente", async () => {
  const { deps } = fakeFinalizar();
  const r = await finalizarGrupoConDeps(deps, { grupoId: "00000000-0000-4000-8000-000000000000", paymentId: "P1" });
  assert.deepEqual(r, { ok: false, error: "grupo_inexistente" });
});

// ---------------------------------------------------------------------------
// Devoluciones, contracargos y rechazos
// ---------------------------------------------------------------------------

function fakeRevertir(grupo: GrupoGuardado, pagadosCon: Record<number, string | null>) {
  const llamadas = { revertidos: [] as number[], fallidos: [] as number[], grupo: [] as string[] };
  const deps: DepsRevertirGrupo = {
    cargarGrupo: async () => grupo,
    revertirPedido: async ({ orderId, mpPaymentId }) => {
      const aplica = pagadosCon[orderId] === mpPaymentId;
      if (aplica) llamadas.revertidos.push(orderId);
      return { applied: aplica };
    },
    marcarFallidoSiPendiente: async (orderId) => {
      llamadas.fallidos.push(orderId);
    },
    marcarGrupo: async (_id, status) => {
      llamadas.grupo.push(status);
    },
  };
  return { deps, llamadas };
}

test("devolución total del pago: se anulan los dos pedidos y el grupo", async () => {
  const { deps, llamadas } = fakeRevertir(
    { id: GRUPO, orderIds: [4701, 4702], status: "PAID", mpPaymentId: "P1" },
    { 4701: "P1", 4702: "P1" },
  );
  const r = await revertirGrupoConDeps(deps, { grupoId: GRUPO, paymentId: "P1", mpStatus: "refunded" });
  assert.deepEqual(r, { ok: true, revertidos: [4701, 4702] });
  assert.deepEqual(llamadas.grupo, ["REFUNDED"]);
  assert.deepEqual(llamadas.fallidos, []);
});

test("contracargo: igual que una devolución total", async () => {
  const { deps, llamadas } = fakeRevertir(
    { id: GRUPO, orderIds: [4701, 4702], status: "PAID", mpPaymentId: "P1" },
    { 4701: "P1", 4702: "P1" },
  );
  await revertirGrupoConDeps(deps, { grupoId: GRUPO, paymentId: "P1", mpStatus: "charged_back" });
  assert.deepEqual(llamadas.revertidos, [4701, 4702]);
  assert.deepEqual(llamadas.grupo, ["REFUNDED"]);
});

test("devolución de un SEGUNDO cobro: no anula la compra pagada con el primero", async () => {
  const { deps, llamadas } = fakeRevertir(
    { id: GRUPO, orderIds: [4701, 4702], status: "PAID", mpPaymentId: "P1" },
    { 4701: "P1", 4702: "P1" },
  );
  await revertirGrupoConDeps(deps, { grupoId: GRUPO, paymentId: "P2", mpStatus: "refunded" });
  assert.deepEqual(llamadas.revertidos, []);
  assert.deepEqual(llamadas.grupo, []);
});

test("pago rechazado: los pedidos que esperaban quedan fallidos (se pueden volver a pagar)", async () => {
  const { deps, llamadas } = fakeRevertir(
    { id: GRUPO, orderIds: [4701, 4702], status: "PENDING", mpPaymentId: null },
    { 4701: null, 4702: null },
  );
  await revertirGrupoConDeps(deps, { grupoId: GRUPO, paymentId: "P1", mpStatus: "rejected" });
  assert.deepEqual(llamadas.fallidos, [4701, 4702]);
  assert.deepEqual(llamadas.grupo, ["FAILED"]);
});

// ---------------------------------------------------------------------------
// Aviso de Mercado Pago (webhook)
// ---------------------------------------------------------------------------

function fakeAviso(pago: PagoLeido, yaVisto = false) {
  const llamadas = { finalizar: 0, revertir: [] as string[] };
  return {
    llamadas,
    deps: {
      leerPago: async () => pago,
      yaProcesado: async () => yaVisto,
      finalizar: async () => {
        llamadas.finalizar += 1;
        return { ok: true as const, confirmados: [4701, 4702], yaPagados: [], fallidos: [], duplicados: [], grupoPagado: true };
      },
      revertir: async (p: { mpStatus: string }) => {
        llamadas.revertir.push(p.mpStatus);
      },
    },
  };
}

test("aviso aprobado de un grupo: finaliza el grupo", async () => {
  const { deps, llamadas } = fakeAviso(pagoOk);
  const r = await procesarAvisoGrupoConDeps(deps, { paymentId: "P1" });
  assert.deepEqual(r, { ok: true, grupoId: GRUPO, status: "approved", note: "grupo_finalizado" });
  assert.equal(llamadas.finalizar, 1);
});

test("aviso ya procesado (mismo pago y estado): no hace nada", async () => {
  const { deps, llamadas } = fakeAviso(pagoOk, true);
  const r = await procesarAvisoGrupoConDeps(deps, { paymentId: "P1" });
  assert.equal(r.note, "already_processed");
  assert.equal(llamadas.finalizar, 0);
});

test("aviso de devolución: revierte el grupo; pendiente: no toca nada", async () => {
  const dev = fakeAviso({ ...pagoOk, status: "refunded" });
  assert.equal((await procesarAvisoGrupoConDeps(dev.deps, { paymentId: "P1" })).note, "grupo_revertido");
  assert.deepEqual(dev.llamadas.revertir, ["refunded"]);
  const pend = fakeAviso({ ...pagoOk, status: "in_process" });
  assert.equal((await procesarAvisoGrupoConDeps(pend.deps, { paymentId: "P1" })).note, "sin_cambios");
  assert.equal(pend.llamadas.finalizar, 0);
});

test("aviso de un pago que no es de grupo: no lo toma", async () => {
  const { deps, llamadas } = fakeAviso({ ...pagoOk, externalReference: "4701" });
  const r = await procesarAvisoGrupoConDeps(deps, { paymentId: "P1" });
  assert.equal(r.note, "no_es_grupo_preventa");
  assert.equal(llamadas.finalizar, 0);
});

// ---------------------------------------------------------------------------
// Comprobante único
// ---------------------------------------------------------------------------

test("comprobante único: los dos packs, su link, el total y la operación", () => {
  const c = armarComprobanteGrupo({
    buyerName: "Ernesto Fernández",
    buyerEmail: "familia@example.com",
    albumTitle: "Acto de Colación · 7° grado · 2026",
    purchasedAt: ahora,
    mpPaymentId: "P1",
    recoverUrl: "https://compramelafoto.com/cliente/recuperar-pack",
    packs: [
      { orderId: 4702, packName: "Pack 2", quantity: 1, totalArs: 20000, packAccessUrl: "https://x/cliente/pack/b" },
      { orderId: 4701, packName: "Libro escolar", quantity: 1, totalArs: 25000, packAccessUrl: "https://x/cliente/pack/a" },
    ],
  });
  assert.match(c.subject, /2 packs/);
  assert.match(c.subject, /#4701, #4702/);
  assert.match(c.text, /Libro escolar/);
  assert.match(c.text, /https:\/\/x\/cliente\/pack\/a/);
  assert.match(c.text, /https:\/\/x\/cliente\/pack\/b/);
  assert.match(c.text, /45\.000/);
  assert.match(c.text, /operación P1/);
  assert.ok(c.text.indexOf("Libro escolar") < c.text.indexOf("Pack 2"), "en orden de pedido");
  assert.match(c.html, /Acceder a Libro escolar/);
  assert.doesNotMatch(c.text, /recuperar-pack/, "con todos los links no hace falta recuperar");
});

test("comprobante único: si falta un link, explica cómo recuperarlo", () => {
  const c = armarComprobanteGrupo({
    buyerName: null,
    buyerEmail: "familia@example.com",
    albumTitle: null,
    purchasedAt: ahora,
    mpPaymentId: null,
    recoverUrl: "https://compramelafoto.com/cliente/recuperar-pack",
    packs: [
      { orderId: 1, packName: "<b>Pack</b>", quantity: 2, totalArs: 100, packAccessUrl: null },
      { orderId: 2, packName: null, quantity: 1, totalArs: 100, packAccessUrl: "https://x/p" },
    ],
  });
  assert.match(c.text, /Hola familia,/);
  assert.match(c.text, /recuperar-pack/);
  assert.match(c.text, /\(×2\)/);
  assert.doesNotMatch(c.html, /<b>Pack<\/b>/, "escapa el HTML del nombre");
});
