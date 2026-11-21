import assert from "node:assert/strict";
import { test } from "node:test";
import { contactoDeRetiro, direccionDelContacto, elegirPuntoDeRetiro, puntosDeRetiroDelAlbum, retiraElCliente, type ContactoParaRetiro } from "./puntos-de-retiro";

const base: ContactoParaRetiro = {
  id: 1,
  nombre: "Lab Centro",
  puntoDeRetiro: true,
  activo: true,
  direccion: "San Martín 100",
  horario: "9 a 18",
  lab: null,
};

test("si retira el fotógrafo no hay puntos", () => {
  assert.deepEqual(puntosDeRetiroDelAlbum("PHOTOGRAPHER", [base]), []);
});

test("retira el cliente (o pickupBy nulo): devuelve los puntos con dirección y horario", () => {
  const esperado = [{ id: 1, nombre: "Lab Centro", direccion: "San Martín 100", horario: "9 a 18" }];
  assert.deepEqual(puntosDeRetiroDelAlbum("CLIENT", [base]), esperado);
  assert.deepEqual(puntosDeRetiroDelAlbum(null, [base]), esperado);
});

test("excluye inactivos, no puntos de retiro y sin ninguna dirección", () => {
  const r = puntosDeRetiroDelAlbum("CLIENT", [
    { ...base, id: 2, activo: false },
    { ...base, id: 3, puntoDeRetiro: false },
    { ...base, id: 4, direccion: " ", lab: null },
    { ...base, id: 5, direccion: null, lab: { address: null, city: "Rosario" } },
  ]);
  assert.deepEqual(r.map((p) => p.id), [5]);
  assert.equal(r[0].direccion, "Rosario");
});

test("sin dirección propia usa la del laboratorio vinculado; horario vacío queda nulo", () => {
  const [p] = puntosDeRetiroDelAlbum("CLIENT", [
    { ...base, direccion: null, horario: "", lab: { address: "Mitre 5", city: "Rosario" } },
  ]);
  assert.equal(p.direccion, "Mitre 5, Rosario");
  assert.equal(p.horario, null);
});

const uno = [{ id: 7, nombre: "A", direccion: "x", horario: null }];
const dos = [...uno, { id: 9, nombre: "B", direccion: "y", horario: null }];

test("sin puntos no se elige nada", () => {
  assert.deepEqual(elegirPuntoDeRetiro([], undefined), { id: null, faltaElegir: false });
  assert.deepEqual(elegirPuntoDeRetiro([], 3), { id: null, faltaElegir: false });
});

test("un solo punto y sin id: ese", () => {
  assert.deepEqual(elegirPuntoDeRetiro(uno), { id: 7, faltaElegir: false });
  assert.deepEqual(elegirPuntoDeRetiro(uno, null), { id: 7, faltaElegir: false });
});

test("varios puntos y sin id: queda nulo y avisa que falta elegir (no frena)", () => {
  assert.deepEqual(elegirPuntoDeRetiro(dos), { id: null, faltaElegir: true });
});

test("id que no está entre los puntos: nulo y falta elegir; uno válido (número o texto) pasa", () => {
  assert.deepEqual(elegirPuntoDeRetiro(dos, 99), { id: null, faltaElegir: true });
  assert.deepEqual(elegirPuntoDeRetiro(uno, 9), { id: null, faltaElegir: true });
  assert.deepEqual(elegirPuntoDeRetiro(dos, "abc"), { id: null, faltaElegir: true });
  assert.deepEqual(elegirPuntoDeRetiro(dos, 9.5), { id: null, faltaElegir: true });
  assert.deepEqual(elegirPuntoDeRetiro(dos, 9), { id: 9, faltaElegir: false });
  assert.deepEqual(elegirPuntoDeRetiro(dos, "7"), { id: 7, faltaElegir: false });
});

test("retiraElCliente: nulo o CLIENT es el cliente; PHOTOGRAPHER no", () => {
  assert.equal(retiraElCliente(null), true);
  assert.equal(retiraElCliente(undefined), true);
  assert.equal(retiraElCliente("CLIENT"), true);
  assert.equal(retiraElCliente("PHOTOGRAPHER"), false);
});

test("direccionDelContacto: la propia, si no la del laboratorio, si no null", () => {
  assert.equal(direccionDelContacto({ direccion: " Mitre 5 ", lab: { address: "Otra", city: "Rosario" } }), "Mitre 5");
  assert.equal(direccionDelContacto({ direccion: "", lab: { address: "Córdoba 900", city: " Rosario " } }), "Córdoba 900, Rosario");
  assert.equal(direccionDelContacto({ direccion: null, lab: { address: null, city: "Rosario" } }), "Rosario");
  assert.equal(direccionDelContacto({ direccion: null, lab: null }), null);
});

test("contactoDeRetiro: el elegido si sigue activo y es punto; si no, el predeterminado; si no, null", () => {
  const c = (id: number, extra: Partial<{ activo: boolean; puntoDeRetiro: boolean; esPredeterminado: boolean }> = {}) =>
    ({ id, activo: true, puntoDeRetiro: true, esPredeterminado: false, ...extra });
  const pred = c(9, { esPredeterminado: true, puntoDeRetiro: false });
  assert.equal(contactoDeRetiro(2, [c(2), pred])?.id, 2);
  assert.equal(contactoDeRetiro(2, [c(2, { activo: false }), pred])?.id, 9, "desactivado: va al predeterminado");
  assert.equal(contactoDeRetiro(2, [pred])?.id, 9, "borrado o ajeno: va al predeterminado");
  assert.equal(contactoDeRetiro(2, [c(2, { puntoDeRetiro: false }), pred])?.id, 9, "dejó de ser punto de retiro");
  assert.equal(contactoDeRetiro(2, [c(2, { puntoDeRetiro: false }), pred], 2)?.id, 2, "es el laboratorio del lote");
  assert.equal(contactoDeRetiro(null, [c(2), pred])?.id, 9);
  assert.equal(contactoDeRetiro(2, [c(2, { activo: false })]), null);
  assert.equal(contactoDeRetiro(2, [c(9, { esPredeterminado: true, activo: false })]), null, "predeterminado inactivo no vale");
});
