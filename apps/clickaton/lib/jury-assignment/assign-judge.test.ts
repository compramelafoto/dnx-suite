import test from "node:test";
import assert from "node:assert/strict";

import {
  categoriasQueFaltanAsignar,
  MOTIVOS_EN_CASTELLANO,
  NO_SE_PUEDE_QUITAR,
  sePuedeAsignar,
  sePuedeQuitar,
  SIN_CONEXION_AL_PADRON,
} from "./assign-judge";

test("un jurado activo y aprobado se puede asignar", () => {
  const r = sePuedeAsignar({ accountStatus: "ACTIVE", directoryReviewStatus: "APPROVED" });
  assert.equal(r.ok, true);
});

test("una cuenta suspendida o dada de baja no recibe trabajo nuevo", () => {
  for (const accountStatus of ["SUSPENDED", "DISABLED", "INVITED", "PENDING_REGISTRATION"]) {
    const r = sePuedeAsignar({ accountStatus, directoryReviewStatus: "APPROVED" });
    assert.equal(r.ok, false, `${accountStatus} no debería poder asignarse`);
    assert.ok(!r.ok && r.motivo === "CUENTA_NO_ACTIVA");
  }
});

test("una ficha sin aprobar no se puede asignar", () => {
  for (const estado of ["PENDING", "REJECTED"]) {
    const r = sePuedeAsignar({ accountStatus: "ACTIVE", directoryReviewStatus: estado });
    assert.equal(r.ok, false, `${estado} no debería poder asignarse`);
    assert.ok(!r.ok && r.motivo === "FICHA_SIN_APROBAR");
  }
});

test("no hace falta estar en el directorio público para trabajar", () => {
  // El directorio decide quién es buscable por otros organizadores, no quién
  // puede calificar: acá ya se sabe a quién se quiere asignar.
  const r = sePuedeAsignar({ accountStatus: "ACTIVE", directoryReviewStatus: "APPROVED" });
  assert.equal(r.ok, true);
});

test("cada motivo tiene su explicación en castellano y sin jerga", () => {
  for (const [motivo, texto] of Object.entries(MOTIVOS_EN_CASTELLANO)) {
    assert.ok(texto.length > 0, `${motivo} sin texto`);
    for (const jerga of ["ACTIVE", "APPROVED", "PENDING", "status", "null"]) {
      assert.ok(!texto.includes(jerga), `${motivo} no debería nombrar ${jerga}`);
    }
  }
});

const YA = [
  { judgeAccountId: "jur-1", categoryId: "cat-a" },
  { judgeAccountId: "jur-2", categoryId: "cat-b" },
];

test("sin asignaciones previas, van todas las elegidas", () => {
  const faltan = categoriasQueFaltanAsignar({
    judgeAccountId: "jur-nuevo",
    categoryIds: ["cat-a", "cat-b"],
    yaAsignadas: YA,
  });
  assert.deepEqual(faltan.sort(), ["cat-a", "cat-b"]);
});

test("una categoría que ya tenía asignada se saltea, no falla", () => {
  const faltan = categoriasQueFaltanAsignar({
    judgeAccountId: "jur-1",
    categoryIds: ["cat-a", "cat-b"],
    yaAsignadas: YA,
  });
  assert.deepEqual(faltan, ["cat-b"]);
});

test("lo que tiene otro jurado no estorba", () => {
  const faltan = categoriasQueFaltanAsignar({
    judgeAccountId: "jur-1",
    categoryIds: ["cat-b"],
    yaAsignadas: YA,
  });
  assert.deepEqual(faltan, ["cat-b"], "cat-b es de jur-2, no de jur-1");
});

test("elegir dos veces la misma categoría no la crea dos veces", () => {
  const faltan = categoriasQueFaltanAsignar({
    judgeAccountId: "jur-nuevo",
    categoryIds: ["cat-a", "cat-a", "cat-a"],
    yaAsignadas: [],
  });
  assert.deepEqual(faltan, ["cat-a"]);
});

test("si ya tenía todo, no queda nada por crear", () => {
  const faltan = categoriasQueFaltanAsignar({
    judgeAccountId: "jur-1",
    categoryIds: ["cat-a"],
    yaAsignadas: YA,
  });
  assert.deepEqual(faltan, []);
});

test("una asignación sin votos se puede quitar", () => {
  assert.equal(sePuedeQuitar({ votos: 0 }), true);
});

test("una asignación con votos no se quita: se llevaría los votos", () => {
  assert.equal(sePuedeQuitar({ votos: 1 }), false);
  assert.equal(sePuedeQuitar({ votos: 40 }), false);
});

test("el aviso de que no se puede quitar dice qué hacer en su lugar", () => {
  assert.match(NO_SE_PUEDE_QUITAR, /suspend/i);
});

test("el aviso de falta de conexión no se confunde con no haber jurados", () => {
  assert.ok(!/no hay jurados/i.test(SIN_CONEXION_AL_PADRON));
  assert.match(SIN_CONEXION_AL_PADRON, /configurar/i);
});
