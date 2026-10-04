/**
 * Reglas de acceso a una vista previa de jurado.
 * Sólo se sirve un asset ACTIVO, de tipo JURY_PREVIEW y guardado en el
 * almacenamiento privado de Clickatón. Cualquier otra cosa es 404.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { resolveJuryPreviewAccess, type JuryPreviewAsset } from "./resolve-preview";

function repoCon(asset: JuryPreviewAsset | null) {
  return { findAsset: async () => asset };
}

const VALIDO: JuryPreviewAsset = {
  id: "a1",
  storageKey: "clickaton/private/entries/e1/s1/preview/x.jpg",
  mimeType: "image/jpeg",
  isActive: true,
  kind: "JURY_PREVIEW",
  storageProvider: "clickaton_private",
};

test("un asset válido se sirve", async () => {
  const r = await resolveJuryPreviewAccess({ assetId: "a1", repo: repoCon(VALIDO) });
  assert.equal(r.ok, true);
  assert.equal(r.ok === true && r.storageKey, VALIDO.storageKey);
  assert.equal(r.ok === true && r.contentType, "image/jpeg");
});

test("un asset inexistente no se sirve", async () => {
  const r = await resolveJuryPreviewAccess({ assetId: "a1", repo: repoCon(null) });
  assert.equal(r.ok === false && r.reason, "NOT_FOUND");
});

test("un asset que no es vista previa de jurado no se sirve", async () => {
  const r = await resolveJuryPreviewAccess({
    assetId: "a1",
    repo: repoCon({ ...VALIDO, kind: "ORIGINAL" }),
  });
  assert.equal(r.ok === false && r.reason, "NOT_A_JURY_PREVIEW");
});

test("un asset dado de baja no se sirve", async () => {
  const r = await resolveJuryPreviewAccess({
    assetId: "a1",
    repo: repoCon({ ...VALIDO, isActive: false }),
  });
  assert.equal(r.ok === false && r.reason, "INACTIVE");
});

test("un asset de otro almacenamiento no se sirve", async () => {
  const r = await resolveJuryPreviewAccess({
    assetId: "a1",
    repo: repoCon({ ...VALIDO, storageProvider: "r2_private" }),
  });
  assert.equal(r.ok === false && r.reason, "FOREIGN_STORAGE");
});

test("nunca sale del prefijo privado de Clickatón", async () => {
  const r = await resolveJuryPreviewAccess({
    assetId: "a1",
    repo: repoCon({ ...VALIDO, storageKey: "clickaton/blog/hero/x.jpg" }),
  });
  assert.equal(r.ok === false && r.reason, "FOREIGN_STORAGE");
});

test("sin mimeType declarado cae a jpeg", async () => {
  const r = await resolveJuryPreviewAccess({
    assetId: "a1",
    repo: repoCon({ ...VALIDO, mimeType: null }),
  });
  assert.equal(r.ok === true && r.contentType, "image/jpeg");
});
