/**
 * El menú de FotoRank depende de la persona, no de la pantalla.
 *
 * Hasta el 2026-09-24 cada área tenía su propio menú y una misma persona veía
 * cuatro distintos. Estos tests fijan la regla nueva: qué secciones ve cada
 * perfil, y que el orden no cambie según cuántos perfiles tenga.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  COLA_DE_REVISION_HREF,
  SECCION,
  menuDeLaCuenta,
  menuDelJuradoSinCuenta,
  type PerfilesDeLaCuenta,
} from "./menuDeLaCuenta";

const NADIE: PerfilesDeLaCuenta = {
  esJurado: false,
  esOrganizador: false,
  esSuperAdmin: false,
  juradosPorRevisar: 0,
};

const titulos = (p: PerfilesDeLaCuenta) => menuDeLaCuenta(p).map((s) => s.title);
const hrefs = (p: PerfilesDeLaCuenta) =>
  menuDeLaCuenta(p).flatMap((s) => s.items.map((i) => i.href));

test("cualquiera con cuenta ve lo suyo: inicio y sus participaciones", () => {
  assert.deepEqual(titulos(NADIE), [SECCION.actividad]);
  assert.deepEqual(hrefs(NADIE), ["/mi-actividad", "/participaciones"]);
});

test("el jurado que también es fotógrafo conserva sus participaciones", () => {
  const menu = hrefs({ ...NADIE, esJurado: true });
  assert.ok(menu.includes("/participaciones"));
  assert.ok(menu.includes("/jurado/panel"));
});

test("el orden es fijo: lo propio, jurado, organizador y al final la plataforma", () => {
  const todo = titulos({
    esJurado: true,
    esOrganizador: true,
    esSuperAdmin: true,
    juradosPorRevisar: 0,
  });
  assert.deepEqual(todo, [
    SECCION.actividad,
    SECCION.jurado,
    SECCION.concursos,
    SECCION.jurados,
    SECCION.resultados,
    SECCION.organizacion,
    SECCION.superAdmin,
  ]);
});

test("sumar un perfil agrega secciones sin reordenar las que ya estaban", () => {
  const soloOrganizador = titulos({ ...NADIE, esOrganizador: true });
  const organizadorYJurado = titulos({ ...NADIE, esOrganizador: true, esJurado: true });
  const sinJurado = organizadorYJurado.filter((t) => t !== SECCION.jurado);
  assert.deepEqual(sinJurado, soloOrganizador);
});

test("sin organización no hay menú de organizador", () => {
  assert.ok(!hrefs({ ...NADIE, esJurado: true }).includes("/dashboard"));
});

test("la cola de revisión muestra cuántas fichas esperan, y nada con la cola vacía", () => {
  const conCola = menuDeLaCuenta({ ...NADIE, esSuperAdmin: true, juradosPorRevisar: 3 });
  const item = conCola.flatMap((s) => s.items).find((i) => i.href === COLA_DE_REVISION_HREF);
  assert.equal(item?.badge, 3);

  const sinCola = menuDeLaCuenta({ ...NADIE, esSuperAdmin: true, juradosPorRevisar: 0 });
  const vacio = sinCola.flatMap((s) => s.items).find((i) => i.href === COLA_DE_REVISION_HREF);
  assert.equal(vacio?.badge, undefined);
});

test("ninguna dirección aparece dos veces en el mismo menú", () => {
  const todas = hrefs({ esJurado: true, esOrganizador: true, esSuperAdmin: true, juradosPorRevisar: 2 });
  assert.equal(new Set(todas).size, todas.length);
});

test("el menú del método viejo de calificación no aparece en ningún lado", () => {
  const todas = hrefs({ esJurado: true, esOrganizador: true, esSuperAdmin: true, juradosPorRevisar: 0 });
  assert.ok(!todas.some((h) => h.includes("/evaluar")));
});

test("quien entró sólo con la clave de jurado ve únicamente su sección", () => {
  const menu = menuDelJuradoSinCuenta();
  assert.deepEqual(
    menu.map((s) => s.title),
    [SECCION.jurado],
  );
});
