import assert from "node:assert/strict";
import test from "node:test";

import { pantallaDelPaso, pantallasDelRecorrido } from "./pantallas";

/**
 * Los enlaces a la pantalla real de cada paso.
 *
 * Sirven para no tener que creerle al ensayo: se abre la pantalla de verdad y
 * se mira. Los pasos que dependen de una inscripción sólo tienen enlace cuando
 * el ensayo completo creó una.
 */

const BASE = { editionSlug: "clickaton-test", editionId: "ed1" };

test("el paso 1 lleva a la página pública de la maratón", () => {
  const p = pantallaDelPaso(1, BASE);
  assert.equal(p?.url, "/maratones/clickaton-test");
  assert.match(p?.etiqueta ?? "", /ver/i);
});

test("el paso 2 lleva al formulario de inscripción", () => {
  assert.equal(pantallaDelPaso(2, BASE)?.url, "/maratones/clickaton-test/inscripcion");
});

test("el paso 6 lleva al escáner de acreditación", () => {
  assert.equal(
    pantallaDelPaso(6, BASE)?.url,
    "/admin/ediciones/ed1/acreditacion/escanear",
  );
});

test("sin inscripción, los pasos del participante no tienen pantalla", () => {
  for (const numero of [5, 7, 8, 9]) {
    assert.equal(
      pantallaDelPaso(numero, BASE),
      null,
      `el paso ${numero} no debería ofrecer pantalla sin inscripción`,
    );
  }
});

test("con inscripción, el paso 5 lleva a la credencial", () => {
  const p = pantallaDelPaso(5, { ...BASE, registrationId: "reg1" });
  assert.equal(p?.url, "/mi-cuenta/inscripciones/reg1");
});

test("con inscripción, los pasos 7 y 8 llevan a la pantalla en vivo", () => {
  assert.equal(pantallaDelPaso(7, { ...BASE, registrationId: "reg1" })?.url, "/en-vivo/reg1");
  assert.equal(pantallaDelPaso(8, { ...BASE, registrationId: "reg1" })?.url, "/en-vivo/reg1");
});

test("el paso 9 lleva a la pantalla en vivo, que es donde se sube", () => {
  assert.equal(pantallaDelPaso(9, { ...BASE, registrationId: "reg1" })?.url, "/en-vivo/reg1");
});

test("el paso 10 lleva al panel de admisión técnica", () => {
  assert.equal(pantallaDelPaso(10, BASE)?.url, "/admin/ediciones/ed1/admision");
});

test("un paso sin pantalla asociada devuelve null", () => {
  assert.equal(pantallaDelPaso(4, BASE), null);
  assert.equal(pantallaDelPaso(99, BASE), null);
});

test("cada pantalla dice si es la vista del participante o la del organizador", () => {
  const participante = pantallaDelPaso(7, { ...BASE, registrationId: "reg1" });
  assert.equal(participante?.publico, "PARTICIPANTE");
  const organizador = pantallaDelPaso(6, BASE);
  assert.equal(organizador?.publico, "ORGANIZADOR");
});

test("el listado del recorrido trae sólo los pasos con pantalla", () => {
  const sinInscripcion = pantallasDelRecorrido(BASE);
  assert.deepEqual(
    sinInscripcion.map((p) => p.numero),
    [1, 2, 6, 10],
  );

  const conInscripcion = pantallasDelRecorrido({ ...BASE, registrationId: "reg1" });
  assert.deepEqual(
    conInscripcion.map((p) => p.numero),
    [1, 2, 5, 6, 7, 8, 9, 10],
  );
});

test("todas las pantallas tienen etiqueta legible", () => {
  for (const p of pantallasDelRecorrido({ ...BASE, registrationId: "reg1" })) {
    assert.ok(p.etiqueta.trim().length > 0, `el paso ${p.numero} no tiene etiqueta`);
    assert.ok(p.url.startsWith("/"), `el paso ${p.numero} no tiene una ruta válida`);
  }
});
