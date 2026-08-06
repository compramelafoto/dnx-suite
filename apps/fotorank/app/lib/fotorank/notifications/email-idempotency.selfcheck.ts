/**
 * Self-check idempotencia PHOTO_RECEIVED / PHOTO_REPLACEMENT_RECEIVED (ETAPA 10C).
 * pnpm --filter fotorank test:email:idempotency
 */
import assert from "node:assert/strict";
import {
  buildPhotoEmailIdempotencyKey,
  enqueueTransactionalEmail,
  getMemoryOutboxSnapshot,
  resetMemoryOutboxForTests,
} from "./outbox";

async function main() {
  // 1) Clave canónica
  assert.equal(
    buildPhotoEmailIdempotencyKey({
      kind: "PHOTO_RECEIVED",
      entryId: "entryA",
      assetVersion: 1,
    }),
    "PHOTO_RECEIVED:entryA:1",
  );
  assert.equal(
    buildPhotoEmailIdempotencyKey({
      kind: "PHOTO_REPLACEMENT_RECEIVED",
      entryId: "entryA",
      assetVersion: 2,
    }),
    "PHOTO_REPLACEMENT_RECEIVED:entryA:2",
  );
  assert.notEqual(
    buildPhotoEmailIdempotencyKey({
      kind: "PHOTO_RECEIVED",
      entryId: "entryA",
      assetVersion: 1,
    }),
    buildPhotoEmailIdempotencyKey({
      kind: "PHOTO_REPLACEMENT_RECEIVED",
      entryId: "entryA",
      assetVersion: 2,
    }),
  );

  // Sin RESEND ni tabla: cae a memoria con dedupe por key
  const prevKey = process.env.RESEND_API_KEY;
  const prevSmtp = process.env.FOTORANK_SMTP_URL;
  delete process.env.RESEND_API_KEY;
  delete process.env.FOTORANK_SMTP_URL;
  resetMemoryOutboxForTests();

  const entryId = `entry-selfcheck-${Date.now().toString(36)}`;
  const base = {
    kind: "PHOTO_RECEIVED" as const,
    toUserId: 1,
    toEmail: "sfef10c-selfcheck@fotorank.test",
    contestId: "contest-selfcheck",
    entryId,
    assetVersion: 1,
    payload: { contestTitle: "Santa Fe en Foco", message: "ok" },
  };

  const first = await enqueueTransactionalEmail(base);
  assert.equal(first.deduplicated, false);

  // Doble confirmación / 5 retries secuenciales
  for (let i = 0; i < 5; i++) {
    const r = await enqueueTransactionalEmail(base);
    assert.equal(r.deduplicated, true, `retry ${i} must dedupe`);
    assert.equal(r.id, first.id);
  }

  // Concurrente
  const concurrent = await Promise.all(
    Array.from({ length: 8 }, () => enqueueTransactionalEmail(base)),
  );
  assert.ok(concurrent.every((r) => r.id === first.id));
  assert.ok(concurrent.every((r) => r.deduplicated));

  // Misma entry, nueva versión → nuevo intent (reemplazo)
  const replace = await enqueueTransactionalEmail({
    ...base,
    kind: "PHOTO_REPLACEMENT_RECEIVED",
    assetVersion: 2,
    payload: { contestTitle: "Santa Fe en Foco", message: "replace", assetVersion: 2 },
  });
  assert.equal(replace.deduplicated, false);
  assert.notEqual(replace.id, first.id);

  const replaceAgain = await enqueueTransactionalEmail({
    ...base,
    kind: "PHOTO_REPLACEMENT_RECEIVED",
    assetVersion: 2,
    payload: { contestTitle: "Santa Fe en Foco", message: "replace", assetVersion: 2 },
  });
  assert.equal(replaceAgain.deduplicated, true);
  assert.equal(replaceAgain.id, replace.id);

  const mem = getMemoryOutboxSnapshot();
  if (mem.length > 0) {
    const keys = new Set(
      mem
        .filter((m) => (m as { entryId?: string }).entryId === entryId)
        .map((m) => (m as { idempotencyKey?: string }).idempotencyKey)
        .filter(Boolean),
    );
    assert.equal(keys.size, 2, "exactamente 2 keys (v1 + v2) en memoria");
  }

  if (prevKey) process.env.RESEND_API_KEY = prevKey;
  if (prevSmtp) process.env.FOTORANK_SMTP_URL = prevSmtp;

  console.log("email-idempotency.selfcheck.ts OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
