/**
 * El menú de FotoRank se organiza por rol.
 *
 * Estos tests fijan: qué roles tiene cada persona, que cada rol muestre sólo
 * lo suyo, que el rol activo lo decida la pantalla y que el super admin no se
 * mezcle con las cuentas de fotógrafo.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  COLA_DE_REVISION_HREF,
  CONEXION_CLICKATON_HREF,
  SECCION,
  menuDeLaCuenta,
  menuDelJuradoSinCuenta,
  rolActivo,
  rolDeLaRuta,
  rolesDeLaCuenta,
  type PerfilesDeLaCuenta,
  type RolDisponible,
} from "./menuDeLaCuenta";

const FOTOGRAFO: PerfilesDeLaCuenta = {
  esJurado: false,
  esOrganizador: false,
  esSuperAdmin: false,
  juradosPorRevisar: 0,
};

const TODO: PerfilesDeLaCuenta = { ...FOTOGRAFO, esJurado: true, esOrganizador: true };

const hrefsDe = (r: RolDisponible | undefined) =>
  (r?.sections ?? []).flatMap((s) => s.items.map((i) => i.href));

test("cualquiera con cuenta es fotógrafo, y sólo fotógrafo si no tiene otro perfil", () => {
  assert.deepEqual(
    rolesDeLaCuenta(FOTOGRAFO).map((r) => r.rol),
    ["fotografo"],
  );
});

test("un organizador que también es jurado tiene los tres roles, en orden fijo", () => {
  assert.deepEqual(
    rolesDeLaCuenta(TODO).map((r) => r.etiqueta),
    ["Fotógrafo", "Jurado", "Organizador"],
  );
});

test("cada rol muestra sólo lo suyo", () => {
  const [fotografo, jurado, organizador] = rolesDeLaCuenta(TODO);
  assert.deepEqual(fotografo?.sections.map((s) => s.title), [SECCION.fotografo]);
  assert.deepEqual(jurado?.sections.map((s) => s.title), [SECCION.jurado]);
  assert.deepEqual(organizador?.sections.map((s) => s.title), [
    SECCION.concursos,
    SECCION.jurados,
    SECCION.resultados,
    SECCION.organizacion,
  ]);
  assert.ok(!hrefsDe(fotografo).includes("/jurado/panel"));
  assert.ok(!hrefsDe(jurado).includes("/participaciones"));
});

test("el jurado conserva su rol de fotógrafo para concursar", () => {
  const roles = rolesDeLaCuenta({ ...FOTOGRAFO, esJurado: true }).map((r) => r.rol);
  assert.deepEqual(roles, ["fotografo", "jurado"]);
});

test("'Organizar un concurso' sólo para quien todavía no organiza", () => {
  assert.ok(hrefsDe(rolesDeLaCuenta(FOTOGRAFO)[0]).includes("/onboarding"));
  assert.ok(!hrefsDe(rolesDeLaCuenta(TODO)[0]).includes("/onboarding"));
});

test("la pantalla decide el rol: /jurados es del organizador y /jurado del jurado", () => {
  assert.equal(rolDeLaRuta("/jurados/directorio"), "organizador");
  assert.equal(rolDeLaRuta("/jurado/panel"), "jurado");
  assert.equal(rolDeLaRuta("/jurado/concursos/abc"), "jurado");
  assert.equal(rolDeLaRuta("/dashboard/concursos/x/jurado"), "organizador");
  assert.equal(rolDeLaRuta("/participaciones/123"), "fotografo");
  assert.equal(rolDeLaRuta("/super-admin"), null);
});

test("en una pantalla de un rol que la persona no tiene, se muestra fotógrafo", () => {
  const roles = rolesDeLaCuenta(FOTOGRAFO);
  assert.equal(rolActivo(roles, "/dashboard")?.rol, "fotografo");
  assert.equal(rolActivo(rolesDeLaCuenta(TODO), "/dashboard")?.rol, "organizador");
});

test("el super admin es sólo super admin: sin selector, sin participaciones ni jurado", () => {
  const menu = menuDeLaCuenta({ ...TODO, esSuperAdmin: true });
  assert.equal(menu.tipo, "superAdmin");
  if (menu.tipo !== "superAdmin") return;
  assert.equal(menu.sections[0]?.title, SECCION.plataforma);
  const todas = menu.sections.flatMap((s) => s.items.map((i) => i.href));
  assert.ok(!todas.includes("/participaciones"));
  assert.ok(!todas.includes("/jurado/panel"));
  assert.ok(todas.includes(CONEXION_CLICKATON_HREF));
});

test("la cola de revisión muestra cuántas fichas esperan, y nada con la cola vacía", () => {
  const item = (n: number) => {
    const menu = menuDeLaCuenta({ ...FOTOGRAFO, esSuperAdmin: true, juradosPorRevisar: n });
    if (menu.tipo !== "superAdmin") return undefined;
    return menu.sections.flatMap((s) => s.items).find((i) => i.href === COLA_DE_REVISION_HREF);
  };
  assert.equal(item(3)?.badge, 3);
  assert.equal(item(0)?.badge, undefined);
});

test("ninguna dirección se repite dentro de un rol", () => {
  for (const r of rolesDeLaCuenta(TODO)) {
    const h = hrefsDe(r);
    assert.equal(new Set(h).size, h.length, r.rol);
  }
});

test("quien entró sólo con la clave de jurado tiene únicamente el rol de jurado", () => {
  const menu = menuDelJuradoSinCuenta();
  assert.equal(menu.tipo, "roles");
  if (menu.tipo === "roles") assert.deepEqual(menu.roles.map((r) => r.rol), ["jurado"]);
});
