/**
 * Enlace firmado de vista previa para jurado.
 * Un enlace copiado no debe servir mañana, y una firma adulterada nunca.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  buildJuryPreviewPath,
  signJuryPreviewLink,
  verifyJuryPreviewLink,
} from "./signed-link";

const SECRET = "secreto-de-prueba-largo-1234";
const ASSET = "asset-abc123";
const AHORA = new Date("2026-09-19T20:00:00.000Z");
const VENCE = new Date("2026-09-19T20:05:00.000Z");

test("una firma recién emitida se acepta", () => {
  const sig = signJuryPreviewLink({ assetId: ASSET, expiresAt: VENCE, secret: SECRET });
  const r = verifyJuryPreviewLink({
    assetId: ASSET,
    exp: String(VENCE.getTime()),
    sig,
    now: AHORA,
    secret: SECRET,
  });
  assert.deepEqual(r, { ok: true });
});

test("vencida se rechaza", () => {
  const sig = signJuryPreviewLink({ assetId: ASSET, expiresAt: VENCE, secret: SECRET });
  const r = verifyJuryPreviewLink({
    assetId: ASSET,
    exp: String(VENCE.getTime()),
    sig,
    now: new Date("2026-09-19T20:05:01.000Z"),
    secret: SECRET,
  });
  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.reason, "EXPIRED");
});

test("firma adulterada se rechaza", () => {
  const r = verifyJuryPreviewLink({
    assetId: ASSET,
    exp: String(VENCE.getTime()),
    sig: "firmafalsa",
    now: AHORA,
    secret: SECRET,
  });
  assert.equal(r.ok === false && r.reason, "BAD_SIGNATURE");
});

test("la firma de una obra no sirve para otra", () => {
  const sig = signJuryPreviewLink({ assetId: ASSET, expiresAt: VENCE, secret: SECRET });
  const r = verifyJuryPreviewLink({
    assetId: "otro-asset",
    exp: String(VENCE.getTime()),
    sig,
    now: AHORA,
    secret: SECRET,
  });
  assert.equal(r.ok === false && r.reason, "BAD_SIGNATURE");
});

test("mover el vencimiento invalida la firma", () => {
  const sig = signJuryPreviewLink({ assetId: ASSET, expiresAt: VENCE, secret: SECRET });
  const r = verifyJuryPreviewLink({
    assetId: ASSET,
    exp: String(new Date("2026-09-20T20:00:00.000Z").getTime()),
    sig,
    now: AHORA,
    secret: SECRET,
  });
  assert.equal(r.ok === false && r.reason, "BAD_SIGNATURE");
});

test("otro secreto no valida", () => {
  const sig = signJuryPreviewLink({ assetId: ASSET, expiresAt: VENCE, secret: SECRET });
  const r = verifyJuryPreviewLink({
    assetId: ASSET,
    exp: String(VENCE.getTime()),
    sig,
    now: AHORA,
    secret: "otro-secreto-igual-de-largo",
  });
  assert.equal(r.ok === false && r.reason, "BAD_SIGNATURE");
});

test("entradas mal formadas se rechazan sin romper", () => {
  for (const exp of ["", "no-es-numero", "-1"]) {
    const r = verifyJuryPreviewLink({
      assetId: ASSET,
      exp,
      sig: "x",
      now: AHORA,
      secret: SECRET,
    });
    assert.equal(r.ok === false && r.reason, "MALFORMED");
  }
});

test("la ruta lleva el asset, el vencimiento y la firma", () => {
  const path = buildJuryPreviewPath({ assetId: ASSET, expiresAt: VENCE, secret: SECRET });
  assert.ok(path.startsWith(`/api/jurado/media/${ASSET}?`));
  const qs = new URLSearchParams(path.split("?")[1]);
  assert.equal(qs.get("exp"), String(VENCE.getTime()));
  assert.ok((qs.get("sig") ?? "").length > 20);
});

/**
 * Vector fijo compartido con FotoRank.
 *
 * La firma se calcula en dos aplicaciones distintas. Si una cambia el propósito,
 * el orden de los campos o la codificación, las pruebas de cada lado seguirían
 * pasando por separado y el jurado no vería una sola foto. Este valor tiene que
 * ser idéntico al de apps/fotorank/app/lib/fotorank/jury/entry-for-juror.test.ts.
 */
const FIRMA_ESPERADA = "QzkxP6BNKog1A6q1CC11qRChUpcuL17XSit2A1B5e-A";

test("la firma coincide con la que emite FotoRank", () => {
  const sig = signJuryPreviewLink({
    assetId: "asset-compat",
    expiresAt: new Date(1758312000000),
    secret: SECRET,
  });
  assert.equal(
    sig,
    FIRMA_ESPERADA,
    "La firma de Clickatón dejó de coincidir con la que emite FotoRank",
  );
});

test("acepta una firma emitida por FotoRank", () => {
  const r = verifyJuryPreviewLink({
    assetId: "asset-compat",
    exp: "1758312000000",
    sig: FIRMA_ESPERADA,
    now: new Date(1758312000000 - 1000),
    secret: SECRET,
  });
  assert.deepEqual(r, { ok: true });
});
