import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Role } from "@prisma/client";
import {
  decideFotografoClientesAccess,
  FOTOGRAFO_CLIENTES_ROLES,
} from "./clientes-sesion-access";

test("sin sesión: 401", () => {
  assert.deepEqual(decideFotografoClientesAccess({ error: "No autenticado", user: null }), {
    ok: false,
    status: 401,
    error: "No autenticado",
  });
});

test("sesión con un rol que no es de fotógrafo: 403", () => {
  assert.deepEqual(decideFotografoClientesAccess({ error: "No autorizado", user: null }), {
    ok: false,
    status: 403,
    error: "No autorizado",
  });
});

test("el fotógrafo es siempre el de la sesión", () => {
  assert.deepEqual(decideFotografoClientesAccess({ error: null, user: { id: 77 } }), {
    ok: true,
    photographerId: 77,
  });
});

test("solo fotógrafos (y laboratorio-fotógrafo) entran a sus clientes", () => {
  assert.deepEqual(FOTOGRAFO_CLIENTES_ROLES, [Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
});

test("las rutas de clientes piden sesión y no leen el photographerId del navegador", () => {
  const base = join(__dirname, "../../app/api/fotografo/clientes");
  for (const file of ["route.ts", "[email]/route.ts"]) {
    const src = readFileSync(join(base, file), "utf8");
    const handlers = (src.match(/export async function (GET|PATCH|DELETE)/g) ?? []).length;
    const guards = (src.match(/await requireSessionPhotographer\(\)/g) ?? []).length;
    assert.ok(handlers > 0, `${file}: sin handlers`);
    assert.equal(guards, handlers, `${file}: cada handler debe pedir sesión`);
    assert.doesNotMatch(src, /searchParams\.get\("photographerId"\)/, file);
    assert.doesNotMatch(src, /\{[^}]*\bphotographerId\b[^}]*\}\s*=\s*body/, file);
  }
});
