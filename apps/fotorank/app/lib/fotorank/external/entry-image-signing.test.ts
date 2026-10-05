import test from "node:test";
import assert from "node:assert/strict";

import { signEntryImageUrl, verifyEntryImageSignature } from "./entry-image-signing";

const SECRET = "secreto-fijo-de-prueba";
const VECTOR_SIG = "uzZ1806XQaqDuSzA1rnOhx8tfbUjNCd35GQxLFe7p6Q";
const EXP = 1800000000;
const base = { entryId: "entry-123", variant: "preview", exp: EXP, wm: "Daniel Cuart", sig: VECTOR_SIG };
const antes = new Date((EXP - 10) * 1000);

test("vector fijo (idéntico en FOTOFFICE)", () => {
  const url = signEntryImageUrl({
    baseUrl: "https://fotorank.com/",
    entryId: "entry-123",
    variant: "preview",
    expiresAt: new Date(EXP * 1000),
    secret: SECRET,
    wm: "Daniel Cuart",
  });
  assert.equal(
    url,
    `https://fotorank.com/api/fotorank/external/entry-image?entryId=entry-123&variant=preview&exp=${EXP}&wm=Daniel%20Cuart&sig=${VECTOR_SIG}`,
  );
});

test("acepta la firma buena", () => {
  assert.deepEqual(verifyEntryImageSignature(base, SECRET, antes), { ok: true });
});

test("rechaza si cambia cualquier dato firmado", () => {
  for (const cambio of [{ entryId: "otra" }, { variant: "original" }, { exp: EXP + 1 }, { wm: "otro" }, { wm: "" }]) {
    assert.deepEqual(verifyEntryImageSignature({ ...base, ...cambio }, SECRET, antes), { ok: false, reason: "BAD_SIGNATURE" });
  }
  assert.deepEqual(verifyEntryImageSignature(base, "otro-secreto", antes), { ok: false, reason: "BAD_SIGNATURE" });
});

test("vencida", () => {
  assert.deepEqual(verifyEntryImageSignature(base, SECRET, new Date((EXP + 1) * 1000)), { ok: false, reason: "EXPIRED" });
});

test("parámetros malos", () => {
  assert.deepEqual(verifyEntryImageSignature(base, "", antes), { ok: false, reason: "BAD_PARAMS" });
  assert.deepEqual(verifyEntryImageSignature({ ...base, variant: "x" }, SECRET, antes), { ok: false, reason: "BAD_PARAMS" });
  assert.deepEqual(verifyEntryImageSignature({ ...base, exp: Number.NaN }, SECRET, antes), { ok: false, reason: "BAD_PARAMS" });
  assert.deepEqual(verifyEntryImageSignature({ ...base, sig: "" }, SECRET, antes), { ok: false, reason: "BAD_PARAMS" });
  assert.deepEqual(verifyEntryImageSignature({ ...base, sig: "corta" }, SECRET, antes), { ok: false, reason: "BAD_SIGNATURE" });
});
