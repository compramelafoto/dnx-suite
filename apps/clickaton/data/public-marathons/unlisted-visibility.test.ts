/**
 * Estado "oculta" (unlisted): routable por link directo, nunca listada ni indexable.
 * Se apoya en ClickatonEdition.isOpsFixture (no requiere migración).
 */

import assert from "node:assert/strict";
import test from "node:test";

import { getPublicMarathonVisibility } from "./visibility";

const base = { status: "registration_open" } as const;

test("edición normal: listada, routable e indexable", () => {
  const v = getPublicMarathonVisibility({ ...base });
  assert.equal(v.listed, true);
  assert.equal(v.routable, true);
  assert.equal(v.indexable, true);
  assert.equal(v.isUnlisted, false);
});

test("edición oculta: routable por link pero fuera de listados", () => {
  const v = getPublicMarathonVisibility({ ...base, isUnlisted: true });
  assert.equal(v.routable, true, "el link directo debe seguir funcionando");
  assert.equal(v.listed, false, "no puede aparecer en home ni /maratones");
  assert.equal(v.indexable, false, "no puede indexarse en buscadores");
  assert.equal(v.isUnlisted, true);
});

test("oculta no se confunde con la demo técnica fixture", () => {
  const v = getPublicMarathonVisibility({ ...base, isUnlisted: true });
  assert.equal(v.isDemo, false, "no debe mostrar el copy 'no abierta a inscripción'");
});

test("borrador oculto sigue sin ser routable", () => {
  const v = getPublicMarathonVisibility({ status: "draft", isUnlisted: true });
  assert.equal(v.routable, false);
  assert.equal(v.listed, false);
});
