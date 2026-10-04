import assert from "node:assert/strict";
import test from "node:test";

import { presentarProgramaDeReferidos } from "./referral-presentation";

const BASE = { code: "CK-7F3K2", colegas: 0, baseUrl: "https://maratonfotografica.com" };

test("el link se arma con el dominio público", () => {
  const p = presentarProgramaDeReferidos(BASE);
  assert.equal(p.link, "https://maratonfotografica.com/i/CK-7F3K2");
});

test("sin colegas invita a empezar, sin prometer un descuento que no tiene", () => {
  const p = presentarProgramaDeReferidos(BASE);
  assert.equal(p.colegas, 0);
  assert.equal(p.descuentoActual, 0);
  assert.equal(p.faltanParaElSiguiente, 1);
  assert.equal(p.siguienteDescuento, 10);
});

test("con un colega ya muestra su 10%", () => {
  const p = presentarProgramaDeReferidos({ ...BASE, colegas: 1 });
  assert.equal(p.descuentoActual, 10);
  assert.equal(p.siguienteDescuento, 20);
  assert.equal(p.faltanParaElSiguiente, 1);
});

test("al llegar a cinco, el mensaje es que ya la tiene gratis", () => {
  const p = presentarProgramaDeReferidos({ ...BASE, colegas: 5 });
  assert.equal(p.descuentoActual, 100);
  assert.equal(p.llegoAlTope, true);
  assert.equal(p.siguienteDescuento, null);
  assert.equal(p.faltanParaElSiguiente, 0);
});

test("traer más de cinco no rompe la pantalla", () => {
  const p = presentarProgramaDeReferidos({ ...BASE, colegas: 12 });
  assert.equal(p.descuentoActual, 100);
  assert.equal(p.llegoAlTope, true);
});

test("la escalera completa se muestra siempre, con el escalón alcanzado marcado", () => {
  const p = presentarProgramaDeReferidos({ ...BASE, colegas: 2 });
  assert.equal(p.escalera.length, 5);
  assert.deepEqual(
    p.escalera.map((e) => e.alcanzado),
    [true, true, false, false, false],
  );
});

test("el progreso hacia el premio grande va de 0 a 100", () => {
  assert.equal(presentarProgramaDeReferidos({ ...BASE, colegas: 0 }).progreso, 0);
  assert.equal(presentarProgramaDeReferidos({ ...BASE, colegas: 1 }).progreso, 20);
  assert.equal(presentarProgramaDeReferidos({ ...BASE, colegas: 5 }).progreso, 100);
  assert.equal(presentarProgramaDeReferidos({ ...BASE, colegas: 9 }).progreso, 100);
});

test("un baseUrl con barra al final no produce una doble barra", () => {
  const p = presentarProgramaDeReferidos({
    ...BASE,
    baseUrl: "https://maratonfotografica.com/",
  });
  assert.equal(p.link, "https://maratonfotografica.com/i/CK-7F3K2");
});
