import test from "node:test";
import assert from "node:assert/strict";
import { bucketOverrideForKey } from "./bucket";

test("las claves equipos/ se firman con el bucket del portal de equipos", () => {
  assert.equal(
    bucketOverrideForKey("equipos/abc.pdf", { EQUIPOS_R2_BUCKET: " bucket-equipos " }),
    "bucket-equipos",
  );
});

test("las claves stolen-gear/ siguen usando el bucket de CLF (sin override)", () => {
  assert.equal(
    bucketOverrideForKey("stolen-gear/abc.jpg", { EQUIPOS_R2_BUCKET: "bucket-equipos" }),
    undefined,
  );
});

test("una clave equipos/ sin EQUIPOS_R2_BUCKET falla en vez de caer en el bucket de CLF", () => {
  assert.throws(() => bucketOverrideForKey("equipos/abc.pdf", {}), /EQUIPOS_R2_BUCKET/);
});
