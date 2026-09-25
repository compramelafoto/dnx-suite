/**
 * El menú de FotoRank depende de la persona, no de la pantalla.
 *
 * Hasta el 2026-09-24 cada área tenía su propio menú y una misma persona veía
 * cuatro distintos. Estos tests fijan la regla nueva: qué secciones ve cada
 * perfil, que el orden no cambie según cuántos tenga, y que el super admin no
 * se mezcle con las cuentas de fotógrafo.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  COLA_DE_REVISION_HREF,
  CONEXION_CLICKATON_HREF,
  SECCION,
  menuDeLaCuenta,
  menuDelJuradoSinCuenta,
  type PerfilesDeLaCuenta,
} from "./menuDeLaCuenta";

const FOTOGRAFO: PerfilesDeLaCuenta = {
  esJurado: false,
  esOrganizador: false,
  esSuperAdmin: false,
  juradosPorRevisar: 0,
};

const titulos = (p: PerfilesDeLaCuenta) => menuDeLaCuenta(p).map((s) => s.title);
const hrefs = (p: PerfilesDeLaCuenta) =>
  menuDeLaCuenta(p).flatMap((s) => s.items.map((i) => i.href));

test("el fotógrafo ve lo suyo y por dónde empezar a organizar", () => {
  assert.deepEqual(titulos(FOTOGRAFO), [SECCION.actividad]);
  assert.deepEqual(hrefs(FOTOGRAFO), ["/mi-actividad", "/participaciones", "/onboarding"]);
});

test("el jurado que también es fotógrafo conserva sus participaciones", () => {
  const menu = hrefs({ ...FOTOGRAFO, esJurado: true });
  assert.ok(menu.includes("/participaciones"));
  assert.ok(menu.includes("/jurado/panel"));
});

test("el organizador que además es fotógrafo y jurado ve las tres cosas, en orden fijo", () => {
  assert.deepEqual(titulos({ ...FOTOGRAFO, esJurado: true, esOrganizador: true }), [
    SECCION.actividad,
    SECCION.jurado,
    SECCION.concursos,
    SECCION.jurados,
    SECCION.resultados,
    SECCION.organizacion,
  ]);
});

test("quien ya organiza no ve 'Organizar un concurso'", () => {
  assert.ok(!hrefs({ ...FOTOGRAFO, esOrganizador: true }).includes("/onboarding"));
});

test("sumar un perfil agrega secciones sin reordenar las que ya estaban", () => {
  const soloOrganizador = titulos({ ...FOTOGRAFO, esOrganizador: true });
  const conJurado = titulos({ ...FOTOGRAFO, esOrganizador: true, esJurado: true });
  assert.deepEqual(
    conJurado.filter((t) => t !== SECCION.jurado),
    soloOrganizador,
  );
});

test("sin organización no hay herramientas de concursos", () => {
  assert.ok(!hrefs({ ...FOTOGRAFO, esJurado: true }).includes("/dashboard"));
});

test("el super admin es sólo super admin: ni participaciones ni jurado", () => {
  const menu = menuDeLaCuenta({
    esJurado: true,
    esOrganizador: true,
    esSuperAdmin: true,
    juradosPorRevisar: 0,
  });
  const titulosSA = menu.map((s) => s.title);
  assert.equal(titulosSA[0], SECCION.plataforma);
  assert.ok(!titulosSA.includes(SECCION.actividad));
  assert.ok(!titulosSA.includes(SECCION.jurado));
  const todas = menu.flatMap((s) => s.items.map((i) => i.href));
  assert.ok(!todas.includes("/participaciones"));
  assert.ok(!todas.includes("/jurado/panel"));
  assert.ok(todas.includes(CONEXION_CLICKATON_HREF));
});

test("la cola de revisión muestra cuántas fichas esperan, y nada con la cola vacía", () => {
  const item = (n: number) =>
    menuDeLaCuenta({ ...FOTOGRAFO, esSuperAdmin: true, juradosPorRevisar: n })
      .flatMap((s) => s.items)
      .find((i) => i.href === COLA_DE_REVISION_HREF);
  assert.equal(item(3)?.badge, 3);
  assert.equal(item(0)?.badge, undefined);
});

test("ninguna dirección aparece dos veces en el mismo menú", () => {
  for (const p of [
    { ...FOTOGRAFO, esJurado: true, esOrganizador: true },
    { ...FOTOGRAFO, esSuperAdmin: true, juradosPorRevisar: 2 },
  ]) {
    const todas = hrefs(p);
    assert.equal(new Set(todas).size, todas.length);
  }
});

test("el método viejo de calificación no aparece en ningún menú", () => {
  const todas = hrefs({ esJurado: true, esOrganizador: true, esSuperAdmin: false, juradosPorRevisar: 0 });
  assert.ok(!todas.some((h) => h.includes("/evaluar")));
});

test("quien entró sólo con la clave de jurado ve únicamente su sección", () => {
  assert.deepEqual(
    menuDelJuradoSinCuenta().map((s) => s.title),
    [SECCION.jurado],
  );
});
