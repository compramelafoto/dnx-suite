import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { consumeRateLimit, rateLimitSize, resetRateLimits } from "./rate-limit";

const T0 = new Date("2026-08-29T12:00:00Z").getTime();
const en = (ms: number) => T0 + ms;

describe("límite de uso", () => {
  it("deja pasar hasta el tope y frena el siguiente", () => {
    resetRateLimits();
    const opts = { limit: 3, windowMs: 60_000 };
    for (let i = 0; i < 3; i += 1) {
      assert.equal(consumeRateLimit("a", { ...opts, now: en(i) }).allowed, true, `intento ${i}`);
    }
    assert.equal(consumeRateLimit("a", { ...opts, now: en(10) }).allowed, false);
  });

  it("dice cuántos segundos faltan para volver a intentar", () => {
    resetRateLimits();
    const opts = { limit: 1, windowMs: 60_000 };
    consumeRateLimit("a", { ...opts, now: T0 });
    const frenado = consumeRateLimit("a", { ...opts, now: en(15_000) });
    assert.equal(frenado.allowed, false);
    assert.equal(frenado.retryAfterSeconds, 45);
  });

  it("la ventana se reinicia cuando pasa", () => {
    resetRateLimits();
    const opts = { limit: 1, windowMs: 60_000 };
    consumeRateLimit("a", { ...opts, now: T0 });
    assert.equal(consumeRateLimit("a", { ...opts, now: en(59_999) }).allowed, false);
    assert.equal(consumeRateLimit("a", { ...opts, now: en(60_000) }).allowed, true);
  });

  it("cada quien tiene su propio cupo", () => {
    resetRateLimits();
    const opts = { limit: 1, windowMs: 60_000, now: T0 };
    assert.equal(consumeRateLimit("a", opts).allowed, true);
    assert.equal(consumeRateLimit("b", opts).allowed, true);
    assert.equal(consumeRateLimit("a", opts).allowed, false);
  });

  it("no acumula memoria: las ventanas vencidas se descartan", () => {
    resetRateLimits();
    const opts = { limit: 5, windowMs: 1_000 };
    for (let i = 0; i < 500; i += 1) {
      consumeRateLimit(`visitante-${i}`, { ...opts, now: en(i) });
    }
    // Una hora después, todo lo viejo ya no debería seguir ocupando lugar.
    consumeRateLimit("alguien", { ...opts, now: en(3_600_000) });
    assert.ok(rateLimitSize() <= 2, `quedaron ${rateLimitSize()} entradas vivas`);
  });
});
