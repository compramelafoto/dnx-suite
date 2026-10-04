/**
 * Una ficha sin lo indispensable no sirve para contratar a nadie y ensucia el
 * directorio. La validación es la puerta, no un adorno de la pantalla.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  validarPostulacion,
  normalizarInstagram,
  normalizarUrl,
  BIO_MINIMA,
  type DatosDePostulacion,
} from "./publicSignupForm";

const BIO_VALIDA = "a".repeat(BIO_MINIMA);

function datosValidos(): DatosDePostulacion {
  return {
    firstName: "Ana",
    lastName: "Pérez",
    email: "ana@ejemplo.com",
    password: "unaclavelarga",
    city: "Santa Fe",
    country: "Argentina",
    professionalHeadline: "Fotógrafa documental",
    shortBio: BIO_VALIDA,
    specialtiesText: "retrato, documental",
    experienceYears: 10,
    aceptaTerminos: true,
    aceptaDatos: true,
    segundosDeLlenado: 30,
  };
}

test("una postulación completa pasa", () => {
  assert.deepEqual(validarPostulacion(datosValidos()), { ok: true });
});

test("faltando cualquier campo obligatorio, no pasa", () => {
  for (const campo of [
    "firstName", "lastName", "email", "city", "country",
    "professionalHeadline", "specialtiesText",
  ] as const) {
    const d = { ...datosValidos(), [campo]: "  " };
    assert.equal(validarPostulacion(d).ok, false, `${campo} vacío debería fallar`);
  }
});

test("la bio corta no alcanza", () => {
  const r = validarPostulacion({ ...datosValidos(), shortBio: "Soy fotógrafa." });
  assert.equal(r.ok, false);
  assert.ok(!r.ok && r.errores.shortBio);
});

test("la contraseña necesita 8 caracteres", () => {
  assert.equal(validarPostulacion({ ...datosValidos(), password: "corta" }).ok, false);
  assert.equal(validarPostulacion({ ...datosValidos(), password: "12345678" }).ok, true);
});

test("el email tiene que parecer un email", () => {
  assert.equal(validarPostulacion({ ...datosValidos(), email: "ana" }).ok, false);
  assert.equal(validarPostulacion({ ...datosValidos(), email: "ana@" }).ok, false);
});

test("hay que aceptar los términos y el tratamiento de datos", () => {
  assert.equal(validarPostulacion({ ...datosValidos(), aceptaTerminos: false }).ok, false);
  assert.equal(validarPostulacion({ ...datosValidos(), aceptaDatos: false }).ok, false);
});

test("los años de experiencia son un número razonable", () => {
  assert.equal(validarPostulacion({ ...datosValidos(), experienceYears: null }).ok, false);
  assert.equal(validarPostulacion({ ...datosValidos(), experienceYears: -1 }).ok, false);
  assert.equal(validarPostulacion({ ...datosValidos(), experienceYears: 90 }).ok, false);
  assert.equal(validarPostulacion({ ...datosValidos(), experienceYears: 0 }).ok, true);
});

test("el campo trampa lleno rechaza sin explicar nada", () => {
  const r = validarPostulacion({ ...datosValidos(), trampa: "spam" });
  assert.equal(r.ok, false);
  assert.ok(!r.ok && r.errores._general);
});

test("llenar el formulario en menos de 3 segundos no es humano", () => {
  assert.equal(validarPostulacion({ ...datosValidos(), segundosDeLlenado: 1 }).ok, false);
  assert.equal(validarPostulacion({ ...datosValidos(), segundosDeLlenado: 3 }).ok, true);
});

test("Instagram se normaliza al usuario sin arroba", () => {
  assert.equal(normalizarInstagram("@ana.foto"), "ana.foto");
  assert.equal(normalizarInstagram("ana.foto"), "ana.foto");
  assert.equal(normalizarInstagram("https://instagram.com/ana.foto"), "ana.foto");
  assert.equal(normalizarInstagram("https://www.instagram.com/ana.foto/"), "ana.foto");
  assert.equal(normalizarInstagram("  "), null);
});

test("una URL sin protocolo no se acepta a medias: se completa o se rechaza", () => {
  assert.equal(normalizarUrl("https://ejemplo.com"), "https://ejemplo.com/");
  assert.equal(normalizarUrl("ejemplo.com"), "https://ejemplo.com/");
  assert.equal(normalizarUrl("javascript:alert(1)"), null);
  assert.equal(normalizarUrl("   "), null);
});
