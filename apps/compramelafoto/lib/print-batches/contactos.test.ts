import assert from "node:assert/strict";
import { test } from "node:test";
import { validarContacto } from "./contactos";

test("faltan nombre o correo", () => {
  assert.equal(validarContacto({ nombre: " ", email: "a@b.com" }, null).ok, false);
  const r = validarContacto({ nombre: "Lab", email: "" }, null);
  assert.equal(r.ok, false);
  const mal = validarContacto({ nombre: "Lab", email: "sin-arroba" }, null);
  assert.equal(mal.ok, false);
});

test("el correo se normaliza a minúsculas y se recortan los textos", () => {
  const r = validarContacto({ nombre: "  Lab Uno ", email: " Lab@Ejemplo.COM " }, null);
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.datos.email, "lab@ejemplo.com");
    assert.equal(r.datos.nombre, "Lab Uno");
  }
});

test("punto de retiro sin dirección ni horario y sin lab vinculado falla", () => {
  const r = validarContacto({ nombre: "Lab", email: "a@b.com", puntoDeRetiro: true }, null);
  assert.deepEqual(r, { ok: false, error: "Para ser punto de retiro cargá la dirección y el horario." });
});

test("punto de retiro con lab vinculado que tiene dirección pasa", () => {
  const r = validarContacto({ nombre: "Lab", email: "a@b.com", puntoDeRetiro: true }, { address: "Calle 1" });
  assert.equal(r.ok, true);
});

test("punto de retiro con lab vinculado sin dirección falla; con dirección y horario propios pasa", () => {
  assert.equal(validarContacto({ nombre: "Lab", email: "a@b.com", puntoDeRetiro: true }, { address: null }).ok, false);
  const r = validarContacto(
    { nombre: "Lab", email: "a@b.com", puntoDeRetiro: true, direccion: "San Martín 1", horario: "9 a 18" },
    null,
  );
  assert.equal(r.ok, true);
});
