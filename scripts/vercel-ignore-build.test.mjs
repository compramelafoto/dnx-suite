import assert from "node:assert/strict";
import { test } from "node:test";

import { cambioDeSchemaQueRompe, decidir } from "./vercel-ignore-build.mjs";

const BASE = `
generator client {
  provider = "prisma-client-js"
}

model Album {
  id    String @id
  title String // el nombre que ve el cliente
  url   String @default("https://compramelafoto.com")
}

enum Rol {
  ADMIN
  SOCIO
}
`;

test("agregar un campo o un modelo no rompe", () => {
  const nuevo = BASE.replace("  title String", "  title String\n  cover String?").concat(
    "\nmodel Nuevo {\n  id String @id\n}\n",
  );
  assert.equal(cambioDeSchemaQueRompe(BASE, nuevo), null);
});

test("cambiar un comentario o el orden no rompe", () => {
  const nuevo = BASE.replace("// el nombre que ve el cliente", "// otro comentario");
  assert.equal(cambioDeSchemaQueRompe(BASE, nuevo), null);
});

test("borrar o cambiar el tipo de un campo rompe", () => {
  assert.match(cambioDeSchemaQueRompe(BASE, BASE.replace("  title String", "")), /model Album/);
  assert.match(cambioDeSchemaQueRompe(BASE, BASE.replace("title String", "title Int")), /model Album/);
});

test("un valor nuevo en un enum rompe: el cliente viejo no sabe leerlo", () => {
  assert.match(cambioDeSchemaQueRompe(BASE, BASE.replace("  SOCIO", "  SOCIO\n  JURADO")), /enum Rol/);
});

test("borrar un modelo rompe", () => {
  const sinAlbum = BASE.replace(/model Album \{[^}]*\}/, "");
  assert.match(cambioDeSchemaQueRompe(BASE, sinAlbum), /se borró model Album/);
});

const carpetas = new Set(["apps/fotorank", "packages/db", "packages/auth"]);
const nunca = () => {
  throw new Error("no debería consultarse");
};
const base = { carpetas, schemaQueRompe: nunca, appImporta: { importacionesDe: nunca, usa: nunca } };

test("un cambio de otra app no compila", () => {
  assert.equal(decidir({ ...base, archivos: ["apps/compramelafoto/app/page.tsx"] }).compilar, false);
});

test("un cambio propio o de un paquete que usa compila", () => {
  assert.equal(decidir({ ...base, archivos: ["apps/fotorank/app/page.tsx"] }).compilar, true);
  assert.equal(decidir({ ...base, archivos: ["packages/auth/src/x.ts"] }).compilar, true);
});

test("migraciones, scripts de operación, pruebas, docs y el lockfile no compilan", () => {
  const archivos = [
    "packages/db/prisma/migrations/20261101_x/migration.sql",
    "packages/db/prisma/scripts/ops-importar.ts",
    "packages/db/docs/MIGRACION.md",
    "packages/db/src/fotoffice-contacts-schema.test.ts",
    "apps/fotorank/lib/puntaje.test.ts",
    "pnpm-lock.yaml",
  ];
  assert.equal(decidir({ ...base, archivos }).compilar, false);
});

test("el schema compila sólo si el cambio rompe", () => {
  const archivos = ["packages/db/prisma/schema.prisma"];
  assert.equal(decidir({ ...base, archivos, schemaQueRompe: () => null }).compilar, false);
  assert.equal(decidir({ ...base, archivos, schemaQueRompe: () => "se borró model X" }).compilar, true);
});

test("un módulo de @repo/db compila sólo si la app lo importa", () => {
  const archivos = ["packages/db/src/fotoffice-team.ts"];
  const importa = (usa) => ({ importacionesDe: () => ["@repo/db/fotoffice-team"], usa: () => usa });
  assert.equal(decidir({ ...base, archivos, appImporta: importa(false) }).compilar, false);
  assert.equal(decidir({ ...base, archivos, appImporta: importa(true) }).compilar, true);
});

test("el cliente de @repo/db o un archivo interno de src compila siempre", () => {
  const appImporta = (lista) => ({ importacionesDe: () => lista, usa: () => false });
  const archivos = ["packages/db/src/client.ts"];
  assert.equal(decidir({ ...base, archivos, appImporta: appImporta(["@repo/db"]) }).compilar, true);
  assert.equal(decidir({ ...base, archivos, appImporta: appImporta([]) }).compilar, true);
});

test("la raíz del monorepo compila", () => {
  assert.equal(decidir({ ...base, archivos: ["turbo.json"] }).compilar, true);
});
