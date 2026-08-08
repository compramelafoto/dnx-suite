/**
 * ETAPA 11D — probe de seguridad del endpoint interno (Production).
 * NO imprime el secreto. Usa FOTORANK_INTERNAL_ASSET_SECRET del entorno.
 *
 *   FOTORANK_PUBLIC_WEB_BASE_URL=https://fotorank.com \
 *     pnpm --filter fotorank exec tsx scripts/ops-11d-canonical-asset-endpoint-probe.ts
 */
const base = (
  process.env.FOTORANK_INTERNAL_ASSET_BASE_URL?.trim() ||
  process.env.FOTORANK_PUBLIC_WEB_BASE_URL?.trim() ||
  "https://fotorank.dnxsuite.com"
).replace(/\/$/, "");
const secret = process.env.FOTORANK_INTERNAL_ASSET_SECRET?.trim() ?? "";
const url = `${base}/api/internal/clickaton/canonical-entry-asset`;

async function post(headers: Record<string, string>, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function main() {
  if (secret.length < 16) throw new Error("ABORT: secret ausente");

  const dummy = {
    contestId: "nonexistent-contest",
    entryId: "nonexistent-entry",
    // >= 32 bytes para pasar INVALID_SIZE y llegar a ENTRY_NOT_FOUND
    fileBase64: Buffer.alloc(64, 1).toString("base64"),
    originalFileName: "x.jpg",
    declaredMime: "image/jpeg",
  };

  const noAuth = await post({}, dummy);
  const badAuth = await post({ authorization: "Bearer wrong-secret-value-xx" }, dummy);
  const goodAuthMissing = await post({ authorization: `Bearer ${secret}` }, dummy);
  const badLegacy = await post(
    { authorization: `Bearer ${secret}` },
    { ...dummy, legacyStorageKey: "https://evil.example/bucket/key" },
  );

  const checks = {
    reject_no_secret: noAuth.status === 401,
    reject_bad_secret: badAuth.status === 401,
    accept_secret_then_validate: [404, 400, 413].includes(goodAuthMissing.status),
    reject_arbitrary_legacy_url: badLegacy.status === 400,
  };
  const ok = Object.values(checks).every(Boolean);
  console.log(JSON.stringify({ ok, base, checks, statuses: {
    noAuth: noAuth.status,
    badAuth: badAuth.status,
    goodAuthMissing: goodAuthMissing.status,
    badLegacy: badLegacy.status,
  } }, null, 2));
  if (!ok) process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
