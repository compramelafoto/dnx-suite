/**
 * pnpm --filter compramelafoto test:fotoffice-vinculo
 *
 * Resumen público del álbum que lee FOTOFFICE para vincular un pedido con su álbum de CLF.
 * La lista de campos es cerrada: nada de compradores ni de alumnos.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { armarResumen, esIdDeAlbum } from "./resumen";

const ALBUM = { id: 1283, title: "Acto de Colación · 7° grado · 2026", publicSlug: "escuela-x-7c1e4a92", isTest: false, isHidden: false, deletedAt: null };

test("con packs: tiene preventa y cierra el día del último pack", () => {
  const r = armarResumen(ALBUM, [
    { validUntil: new Date("2026-11-10T23:59:00-03:00"), isActive: true },
    { validUntil: new Date("2026-11-15T23:59:00-03:00"), isActive: true },
    { validUntil: null, isActive: true },
    { validUntil: new Date("2027-12-31T23:59:00-03:00"), isActive: false },
  ]);
  assert.deepEqual(r, {
    id: 1283,
    titulo: "Acto de Colación · 7° grado · 2026",
    slug: "escuela-x-7c1e4a92",
    tienePreventa: true,
    preventaCierraEl: new Date("2026-11-15T23:59:00-03:00").toISOString(),
  });
});

test("sin packs: sin preventa y sin fecha de cierre", () => {
  const r = armarResumen(ALBUM, []);
  assert.equal(r?.tienePreventa, false);
  assert.equal(r?.preventaCierraEl, null);
});

test("packs sin vencimiento: hay preventa pero no fecha", () => {
  const r = armarResumen(ALBUM, [{ validUntil: null, isActive: true }]);
  assert.equal(r?.tienePreventa, true);
  assert.equal(r?.preventaCierraEl, null);
});

test("álbum de prueba o borrado: no hay resumen", () => {
  assert.equal(armarResumen({ ...ALBUM, isTest: true }, []), null);
  assert.equal(armarResumen({ ...ALBUM, deletedAt: new Date() }, []), null);
  assert.equal(armarResumen({ ...ALBUM, isHidden: true }, []), null);
});

test("lista blanca: sólo estos cinco campos", () => {
  const r = armarResumen(ALBUM, [{ validUntil: null, isActive: true }]);
  assert.deepEqual(Object.keys(r ?? {}).sort(), ["id", "preventaCierraEl", "slug", "tienePreventa", "titulo"]);
});

test("un segmento sólo de dígitos se busca por id", () => {
  assert.equal(esIdDeAlbum("1283"), 1283);
  assert.equal(esIdDeAlbum("escuela-x-7c1e4a92"), null);
  assert.equal(esIdDeAlbum("0"), null);
  assert.equal(esIdDeAlbum("99999999999"), null);
});

test("todos los packs inactivos: la preventa cerró y la fecha sale del último", () => {
  const r = armarResumen(ALBUM, [
    { validUntil: new Date("2026-11-15T23:59:00-03:00"), isActive: false },
    { validUntil: new Date("2026-11-10T23:59:00-03:00"), isActive: false },
  ]);
  assert.equal(r?.tienePreventa, true);
  assert.equal(r?.preventaCierraEl, new Date("2026-11-15T23:59:00-03:00").toISOString());
});
