/**
 * pnpm --filter compramelafoto test:fotoffice-vinculo
 *
 * Venta tal como la ve FOTOFFICE. La lista de campos es cerrada: si alguien agrega un dato del comprador o
 * del alumno, esta prueba falla.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CAMPOS_VENTA_FOTOFFICE,
  armarPagina,
  codificarCursor,
  decodificarCursor,
  detalleDeVenta,
  type EntradaVenta,
  ventaParaFotoffice,
} from "./ventas";

const PAGADO = new Date("2026-11-03T15:20:00.000Z");
const ACTUALIZADO = new Date("2026-11-03T15:21:00.000Z");

function entrada(extra: Partial<EntradaVenta> = {}): EntradaVenta {
  return {
    order: {
      id: 4646,
      mpPaymentId: "1325551234",
      status: "PAID",
      updatedAt: ACTUALIZADO,
      totalCents: 20000,
      platformCommissionCents: 2609,
      referralFeeDiscountCents: 0,
    },
    album: { id: 1283, title: "Acto de Colación · 7° grado" },
    logs: [{ eventType: "PAYMENT_APPROVED", createdAt: PAGADO }],
    packName: null,
    items: [{ productType: "DIGITAL", size: null, quantity: 3 }],
    videos: 0,
    organizador: null,
    duenoMpUserId: "97484805",
    ...extra,
  };
}

const ESPERADOS = [
  "orderId",
  "mpPaymentId",
  "estado",
  "motivo",
  "pagadoEl",
  "actualizadoEl",
  "album",
  "detalle",
  "pagoFamilia",
  "comisionPlataforma",
  "descuentoReferidos",
  "comisionOrganizador",
  "retenidoEsperadoMp",
  "netoFotografo",
  "cobrador",
  "cobradorMpUserId",
].sort();

test("lista blanca: sólo los campos de VentaFotoffice, aunque la entrada traiga datos personales", () => {
  const sucia = {
    ...entrada(),
    buyerEmail: "familia@example.com",
    buyerName: "Ana Pérez",
    buyerPhone: "+5491100000000",
    studentFirstName: "Juli",
    buyerUserId: 99,
    order: { ...entrada().order, buyerEmail: "familia@example.com", buyerName: "Ana", buyerPhone: "123" },
    album: { id: 1283, title: "Acto", publicSlug: "x", userId: 79 },
  } as unknown as EntradaVenta;
  const v = ventaParaFotoffice(sucia);
  assert.deepEqual(Object.keys(v).sort(), ESPERADOS);
  assert.deepEqual([...CAMPOS_VENTA_FOTOFFICE].sort(), ESPERADOS);
  assert.deepEqual(Object.keys(v.album).sort(), ["id", "titulo"]);
  const texto = JSON.stringify(v);
  for (const dato of ["familia@example.com", "Ana", "Juli", "5491100000000", "publicSlug"]) {
    assert.equal(texto.includes(dato), false, dato);
  }
});

test("venta común: montos en pesos y cobra el fotógrafo", () => {
  const v = ventaParaFotoffice(entrada());
  assert.deepEqual(v, {
    orderId: 4646,
    mpPaymentId: "1325551234",
    estado: "PAID",
    motivo: null,
    pagadoEl: "2026-11-03T15:20:00.000Z",
    actualizadoEl: "2026-11-03T15:21:00.000Z",
    album: { id: 1283, titulo: "Acto de Colación · 7° grado" },
    detalle: "3 digitales",
    pagoFamilia: 20000,
    comisionPlataforma: 2609,
    descuentoReferidos: 0,
    comisionOrganizador: 0,
    retenidoEsperadoMp: 2609,
    netoFotografo: 17391,
    cobrador: "PHOTOGRAPHER",
    cobradorMpUserId: "97484805",
  });
});

test("con descuento de referidos: el retenido baja y el neto sube", () => {
  const v = ventaParaFotoffice(entrada({ order: { ...entrada().order, referralFeeDiscountCents: 500 } }));
  assert.equal(v.comisionPlataforma, 2609);
  assert.equal(v.descuentoReferidos, 500);
  assert.equal(v.retenidoEsperadoMp, 2109);
  assert.equal(v.netoFotografo, 17891);
});

test("con organizador que retiene: neto = photographerNetAmount y el retenido suma la comisión del organizador", () => {
  const v = ventaParaFotoffice(
    entrada({
      organizador: { photographerNetAmount: 15000, organizerCommissionAmount: 2391, payoutMode: "MARKETPLACE_SPLIT", organizadorMpUserId: "555" },
    }),
  );
  assert.equal(v.netoFotografo, 15000);
  assert.equal(v.comisionOrganizador, 2391);
  assert.equal(v.retenidoEsperadoMp, 2609 + 2391);
  assert.equal(v.cobrador, "PHOTOGRAPHER");
  assert.equal(v.cobradorMpUserId, "97484805");
});

test("si cobra el organizador, el retenido no suma su comisión y el cobrador es él", () => {
  const v = ventaParaFotoffice(
    entrada({
      organizador: { photographerNetAmount: 0, organizerCommissionAmount: 17391, payoutMode: "ORGANIZER_AS_COLLECTOR", organizadorMpUserId: "555" },
    }),
  );
  assert.equal(v.retenidoEsperadoMp, 2609);
  assert.equal(v.comisionOrganizador, 17391);
  assert.equal(v.cobrador, "ORGANIZER");
  assert.equal(v.cobradorMpUserId, null); // la cuenta del organizador (un tercero) no viaja
});

test("montos Decimal con centavos se redondean a dos decimales", () => {
  const v = ventaParaFotoffice(
    entrada({ organizador: { photographerNetAmount: 15000.505, organizerCommissionAmount: 2391.1, payoutMode: "HELD_BY_PLATFORM", organizadorMpUserId: null } }),
  );
  assert.equal(v.netoFotografo, 15000.51);
  assert.equal(v.retenidoEsperadoMp, 5000.1);
});

test("motivo: reintegro, contracargo o rechazo según el último log", () => {
  const reintegrado = ventaParaFotoffice(
    entrada({
      order: { ...entrada().order, status: "REFUNDED" },
      logs: [
        { eventType: "PAYMENT_APPROVED", createdAt: PAGADO },
        { eventType: "PAYMENT_REFUNDED", createdAt: new Date("2026-11-05T10:00:00Z") },
      ],
    }),
  );
  assert.equal(reintegrado.estado, "REFUNDED");
  assert.equal(reintegrado.motivo, "reintegro");
  assert.equal(reintegrado.pagadoEl, PAGADO.toISOString());

  const contracargo = ventaParaFotoffice(
    entrada({
      order: { ...entrada().order, status: "FAILED" },
      logs: [
        { eventType: "PAYMENT_REFUNDED", createdAt: new Date("2026-11-04T10:00:00Z") },
        { eventType: "PAYMENT_APPROVED", createdAt: PAGADO },
        { eventType: "PAYMENT_CHARGED_BACK", createdAt: new Date("2026-11-06T10:00:00Z") },
      ],
    }),
  );
  assert.equal(contracargo.motivo, "contracargo");

  const rechazo = ventaParaFotoffice(entrada({ order: { ...entrada().order, status: "FAILED" } }));
  assert.equal(rechazo.motivo, "rechazo");

  const pagada = ventaParaFotoffice(
    entrada({ logs: [{ eventType: "PAYMENT_REFUNDED", createdAt: new Date("2026-11-01T10:00:00Z") }, { eventType: "PAYMENT_APPROVED", createdAt: PAGADO }] }),
  );
  assert.equal(pagada.motivo, null);
});

test("pagadoEl es la última aprobación (pedido recuperado después de fallar)", () => {
  const segunda = new Date("2026-11-04T09:00:00.000Z");
  const v = ventaParaFotoffice(entrada({ logs: [{ eventType: "PAYMENT_APPROVED", createdAt: PAGADO }, { eventType: "PAYMENT_APPROVED", createdAt: segunda }] }));
  assert.equal(v.pagadoEl, segunda.toISOString());
});

test("detalle: pack por nombre o resumen por tipo, sin datos personales", () => {
  assert.equal(detalleDeVenta({ packName: "  Pack Egresados  ", items: [{ productType: "DIGITAL", size: null, quantity: 5 }], videos: 0 }), "Pack: Pack Egresados");
  assert.equal(
    detalleDeVenta({
      packName: null,
      items: [
        { productType: "PRINT", size: "15x21", quantity: 1 },
        { productType: "DIGITAL", size: null, quantity: 2 },
        { productType: "PRINT", size: "15x21", quantity: 1 },
        { productType: "DIGITAL", size: null, quantity: 1 },
        { productType: "PRINT", size: "10X15", quantity: 1 },
        { productType: "FRAME", size: "20x30", quantity: 1 },
      ],
      videos: 2,
    }),
    "3 digitales · 2 impresas 15×21 · 1 impresa 10×15 · 1 cuadro 20×30 · 2 videos",
  );
  assert.equal(detalleDeVenta({ packName: null, items: [{ productType: "DIGITAL", size: null, quantity: 1 }], videos: 0 }), "1 digital");
  assert.equal(detalleDeVenta({ packName: null, items: [{ productType: "PRINT", size: null, quantity: 2 }], videos: 1 }), "2 impresas · 1 video");
  assert.equal(detalleDeVenta({ packName: null, items: [], videos: 0 }), "Sin detalle");
});

test("cursor: ida y vuelta, y uno inválido da null", () => {
  const c = codificarCursor({ updatedAt: ACTUALIZADO, id: 4646 });
  assert.match(c, /^[A-Za-z0-9_-]+$/);
  assert.deepEqual(decodificarCursor(c), { updatedAt: ACTUALIZADO, id: 4646 });
  assert.equal(Buffer.from(c, "base64url").toString("utf8"), "2026-11-03T15:21:00.000Z|4646");

  const malo = (s: string) => Buffer.from(s, "utf8").toString("base64url");
  for (const invalido of ["", "%%%", malo("hola"), malo("2026-13-45T00:00:00.000Z|1"), malo("2026-11-03T15:21:00.000Z|0"), malo("2026-11-03T15:21:00.000Z|-3"), malo("2026-11-03T15:21:00.000Z|1.5"), malo("2026-11-03T15:21:00.000Z|abc"), "x".repeat(500)]) {
    assert.equal(decodificarCursor(invalido), null, invalido);
  }
  assert.equal(decodificarCursor(null), null);
});

test("página: siguiente es el cursor de la última fila, hayMas sale de pedir limite + 1", () => {
  const fila = (id: number) => ({ id, updatedAt: new Date(`2026-11-0${id}T10:00:00.000Z`) });
  const conver = (f: { id: number }) => ({ orderId: f.id });

  const llena = armarPagina([fila(1), fila(2), fila(3)], 2, null, conver);
  assert.deepEqual(llena.ventas, [{ orderId: 1 }, { orderId: 2 }]);
  assert.equal(llena.hayMas, true);
  assert.deepEqual(decodificarCursor(llena.siguiente), fila(2));

  const ultima = armarPagina([fila(3)], 2, llena.siguiente, conver);
  assert.equal(ultima.hayMas, false);
  assert.deepEqual(decodificarCursor(ultima.siguiente), fila(3));

  const vacia = armarPagina([], 2, ultima.siguiente, conver);
  assert.deepEqual(vacia, { ventas: [], siguiente: ultima.siguiente, hayMas: false });
  assert.deepEqual(armarPagina([], 2, null, conver), { ventas: [], siguiente: null, hayMas: false });

  // Una fila descartada al final (sin aprobación) igual hace avanzar el cursor: no se relee.
  const descartada = armarPagina([fila(4), fila(5)], 2, null, (f) => (f.id === 5 ? null : conver(f)));
  assert.deepEqual(descartada.ventas, [{ orderId: 4 }]);
  assert.deepEqual(decodificarCursor(descartada.siguiente), fila(5));
});
