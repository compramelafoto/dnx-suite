import { test } from "node:test";
import assert from "node:assert/strict";
import { FILTRO_VACIO, coincideConElTexto, diaArgentino, filtrarParaImprimir, filtrosActivos, opcionesDelFiltro } from "./filtro-para-imprimir";
import type { PedidoDelPanel } from "./panel";

const pedido = (o: Partial<PedidoDelPanel>): PedidoDelPanel => ({
  albumOrderId: 1, cliente: "Cliente", album: "Álbum", copias: [{ medida: "15x21", acabado: "Brillo", cantidad: 1 }], totalCopias: 1,
  retiraCliente: false, pickupLabContactId: null, pagadoAt: "2026-11-10T15:00:00.000Z", motivo: null, email: null, telefono: null, ...o,
});

const juan = pedido({ albumOrderId: 101, cliente: "Juan Pérez", email: "juanp@correo.com", telefono: "+54 9 345 407-3061", album: "Egresados San José", copias: [{ medida: "15x21", acabado: "Mate", cantidad: 3 }], totalCopias: 3, pagadoAt: "2026-11-01T12:00:00.000Z" });
const ana = pedido({ albumOrderId: 202, cliente: "Ana Gómez", email: "ana@x.com", album: "Maratón Paraná", copias: [{ medida: "10x15", acabado: "Brillo", cantidad: 8 }], totalCopias: 8, retiraCliente: true, pickupLabContactId: 7, pagadoAt: "2026-11-20T02:00:00.000Z" });
const roto = pedido({ albumOrderId: 303, cliente: "Zoe", album: "Egresados San José", motivo: "Le faltan fotos", pagadoAt: "2026-11-15T12:00:00.000Z" });
const todos = [ana, roto, juan];
const ids = (ps: PedidoDelPanel[]) => ps.map((p) => p.albumOrderId);

test("el texto busca sin tildes ni mayúsculas, en cliente, correo, álbum, medida y acabado", () => {
  assert.equal(coincideConElTexto(juan, "perez"), true);
  assert.equal(coincideConElTexto(juan, "JUANP@"), true);
  assert.equal(coincideConElTexto(juan, "san jose"), true);
  assert.equal(coincideConElTexto(juan, "15x21 mate"), true);
  assert.equal(coincideConElTexto(juan, "juan 10x15"), false);
  assert.equal(coincideConElTexto(juan, "   "), true);
});

test("el texto encuentra el número de pedido y el teléfono sin importar guiones ni espacios", () => {
  assert.equal(coincideConElTexto(juan, "#101"), true);
  assert.equal(coincideConElTexto(juan, "101"), true);
  assert.equal(coincideConElTexto(juan, "3454073061"), true);
  assert.equal(coincideConElTexto(juan, "407-3061"), true);
  assert.equal(coincideConElTexto(ana, "3061"), false);
});

test("sin filtros vienen todos, del pago más viejo al más nuevo", () => {
  assert.deepEqual(ids(filtrarParaImprimir(todos, FILTRO_VACIO)), [101, 303, 202]);
  assert.equal(filtrosActivos(FILTRO_VACIO), 0);
});

test("filtra por álbum, medida, entrega, laboratorio y estado", () => {
  assert.deepEqual(ids(filtrarParaImprimir(todos, { ...FILTRO_VACIO, album: "Egresados San José" })), [101, 303]);
  assert.deepEqual(ids(filtrarParaImprimir(todos, { ...FILTRO_VACIO, medida: "10x15" })), [202]);
  assert.deepEqual(ids(filtrarParaImprimir(todos, { ...FILTRO_VACIO, entrega: "RETIRA_EN_LAB" })), [202]);
  assert.deepEqual(ids(filtrarParaImprimir(todos, { ...FILTRO_VACIO, entrega: "LA_ENTREGAS_VOS" })), [101, 303]);
  assert.deepEqual(ids(filtrarParaImprimir(todos, { ...FILTRO_VACIO, laboratorio: "7" })), [202]);
  assert.deepEqual(ids(filtrarParaImprimir(todos, { ...FILTRO_VACIO, laboratorio: "SIN" })), [101, 303]);
  assert.deepEqual(ids(filtrarParaImprimir(todos, { ...FILTRO_VACIO, estado: "CON_PROBLEMA" })), [303]);
  assert.deepEqual(ids(filtrarParaImprimir(todos, { ...FILTRO_VACIO, estado: "LISTOS" })), [101, 202]);
});

test("las fechas de pago se cuentan en hora de Argentina", () => {
  // 20/11 02:00 UTC es el 19/11 a las 23:00 en Argentina.
  assert.equal(diaArgentino(ana.pagadoAt), "2026-11-19");
  assert.deepEqual(ids(filtrarParaImprimir(todos, { ...FILTRO_VACIO, desde: "2026-11-19", hasta: "2026-11-19" })), [202]);
  assert.deepEqual(ids(filtrarParaImprimir(todos, { ...FILTRO_VACIO, hasta: "2026-11-15" })), [101, 303]);
  assert.equal(filtrosActivos({ ...FILTRO_VACIO, desde: "2026-11-19", texto: "x" }), 2);
});

test("ordena por más nuevos, cliente o cantidad de copias", () => {
  assert.deepEqual(ids(filtrarParaImprimir(todos, { ...FILTRO_VACIO, orden: "MAS_NUEVOS" })), [202, 303, 101]);
  assert.deepEqual(ids(filtrarParaImprimir(todos, { ...FILTRO_VACIO, orden: "CLIENTE" })), [202, 101, 303]);
  assert.deepEqual(ids(filtrarParaImprimir(todos, { ...FILTRO_VACIO, orden: "MAS_COPIAS" })), [202, 101, 303]);
});

test("las opciones salen de los pedidos, sin repetir y ordenadas", () => {
  const o = opcionesDelFiltro([...todos, pedido({ copias: [{ medida: "20x30", acabado: "Mate", cantidad: 1 }] })]);
  assert.deepEqual(o.albumes, ["Álbum", "Egresados San José", "Maratón Paraná"]);
  assert.deepEqual(o.medidas, ["10x15", "15x21", "20x30"]);
});
