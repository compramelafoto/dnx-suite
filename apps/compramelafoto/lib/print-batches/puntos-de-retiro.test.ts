import assert from "node:assert/strict";
import { test } from "node:test";
import { elegirPuntoDeRetiro, puntosDeRetiroDelAlbum, type ContactoParaRetiro } from "./puntos-de-retiro";

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
  assert.deepEqual(elegirPuntoDeRetiro([], undefined), { ok: true, id: null });
  assert.deepEqual(elegirPuntoDeRetiro([], 3), { ok: true, id: null });
});

test("un solo punto y sin id: ese", () => {
  assert.deepEqual(elegirPuntoDeRetiro(uno), { ok: true, id: 7 });
  assert.deepEqual(elegirPuntoDeRetiro(uno, null), { ok: true, id: 7 });
});

test("varios puntos y sin id: pide elegir", () => {
  assert.deepEqual(elegirPuntoDeRetiro(dos), { ok: false, error: "Elegí dónde retirar tus copias." });
});

test("id que no está entre los puntos: pide elegir; uno válido (número o texto) pasa", () => {
  assert.equal(elegirPuntoDeRetiro(dos, 99).ok, false);
  assert.equal(elegirPuntoDeRetiro(uno, 9).ok, false);
  assert.equal(elegirPuntoDeRetiro(dos, "abc").ok, false);
  assert.equal(elegirPuntoDeRetiro(dos, 9.5).ok, false);
  assert.deepEqual(elegirPuntoDeRetiro(dos, 9), { ok: true, id: 9 });
  assert.deepEqual(elegirPuntoDeRetiro(dos, "7"), { ok: true, id: 7 });
});
