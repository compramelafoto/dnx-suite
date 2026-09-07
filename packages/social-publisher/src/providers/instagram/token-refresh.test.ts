import assert from "node:assert/strict";
import { test } from "node:test";
import { decideTokenRefresh, refreshInstagramToken } from "./token-refresh";

const ahora = new Date("2026-09-05T12:00:00Z");
const hace = (horas: number) => new Date(ahora.getTime() - horas * 3600_000);
const dentroDe = (dias: number) => new Date(ahora.getTime() + dias * 86400_000);

test("renueva cuando quedan menos de 10 días", () => {
  const d = decideTokenRefresh({
    createdAt: hace(50 * 24),
    expiresAt: dentroDe(9),
    now: ahora,
  });
  assert.deepEqual(d, { action: "REFRESH" });
});

test("no renueva si al token le queda mucho", () => {
  const d = decideTokenRefresh({
    createdAt: hace(48),
    expiresAt: dentroDe(40),
    now: ahora,
  });
  assert.deepEqual(d, { action: "SKIP", reason: "NOT_DUE" });
});

test("no renueva un token con menos de 24 horas: Meta lo rechaza", () => {
  const d = decideTokenRefresh({
    createdAt: hace(3),
    expiresAt: dentroDe(2),
    now: ahora,
  });
  assert.deepEqual(d, { action: "SKIP", reason: "TOO_YOUNG" });
});

test("un token ya vencido no se renueva: hay que reconectar", () => {
  const d = decideTokenRefresh({
    createdAt: hace(70 * 24),
    expiresAt: hace(1),
    now: ahora,
  });
  assert.deepEqual(d, { action: "SKIP", reason: "EXPIRED" });
});

test("sin fecha de vencimiento se renueva igual, por las dudas", () => {
  const d = decideTokenRefresh({
    createdAt: hace(48),
    expiresAt: null,
    now: ahora,
  });
  assert.deepEqual(d, { action: "REFRESH" });
});

test("la renovación devuelve el token nuevo y su vencimiento", async () => {
  const fetchImpl = (async (input: string | URL) => {
    assert.ok(String(input).includes("grant_type=ig_refresh_token"));
    return new Response(
      JSON.stringify({ access_token: "renovado", expires_in: 5184000 }),
      { status: 200 },
    );
  }) as unknown as typeof fetch;

  const r = await refreshInstagramToken("viejo", { fetchImpl, now: () => ahora });
  assert.equal(r.accessToken, "renovado");
  assert.equal(r.expiresAt.toISOString(), "2026-11-04T12:00:00.000Z");
});

test("si Meta rechaza la renovación, el error es reintentable solo si es de servidor", async () => {
  const fetchImpl = (async () =>
    new Response(JSON.stringify({ error: { message: "token inválido" } }), {
      status: 400,
    })) as unknown as typeof fetch;

  await assert.rejects(
    () => refreshInstagramToken("roto", { fetchImpl }),
    (e: Error & { retryable?: boolean }) => e.retryable === false,
  );
});
