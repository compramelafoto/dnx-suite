import assert from "node:assert/strict";
import test from "node:test";

import {
  cierreAAplicar,
  enHoraArgentina,
  estadoAlReprogramar,
  seForzanVentanas,
} from "./demo-schedule";

test("la hora local argentina se convierte a UTC sumando tres horas", () => {
  assert.equal(enHoraArgentina("2026-09-02 10:00").toISOString(), "2026-09-02T13:00:00.000Z");
  assert.equal(enHoraArgentina("2026-09-05 23:00").toISOString(), "2026-09-06T02:00:00.000Z");
  assert.equal(enHoraArgentina("2026-09-02 07:00").toISOString(), "2026-09-02T10:00:00.000Z");
});

test("una fecha mal escrita falla fuerte en vez de generar un horario silencioso", () => {
  assert.throws(() => enHoraArgentina("2 de septiembre"), /Fecha inválida/);
});

test("volver a correr el guion no acorta una demo abierta", () => {
  const guardado = enHoraArgentina("2026-09-05 23:00");
  const configurado = enHoraArgentina("2026-09-02 14:00");
  assert.equal(cierreAAplicar(guardado, configurado).toISOString(), guardado.toISOString());
});

test("si el guion extiende más que lo guardado, gana el guion", () => {
  const guardado = enHoraArgentina("2026-09-02 14:00");
  const configurado = enHoraArgentina("2026-09-05 23:00");
  assert.equal(cierreAAplicar(guardado, configurado).toISOString(), configurado.toISOString());
});

test("se puede acortar a propósito, pero hay que pedirlo", () => {
  const guardado = enHoraArgentina("2026-09-05 23:00");
  const configurado = enHoraArgentina("2026-09-02 14:00");
  assert.equal(
    cierreAAplicar(guardado, configurado, true).toISOString(),
    configurado.toISOString(),
  );
  assert.equal(seForzanVentanas({} as NodeJS.ProcessEnv), false);
  assert.equal(
    seForzanVentanas({ CLICKATON_SEED_DEMO_FORZAR_VENTANAS: "1" } as NodeJS.ProcessEnv),
    true,
  );
});

test("sin nada guardado se aplica lo configurado", () => {
  const configurado = enHoraArgentina("2026-09-05 23:00");
  assert.equal(cierreAAplicar(null, configurado).toISOString(), configurado.toISOString());
});

test("una consigna ya liberada NUNCA vuelve a bloquearse", () => {
  const liberada = { status: "RELEASED" as const, releasedAt: new Date("2026-09-02T13:00:00Z") };
  const resultado = estadoAlReprogramar(liberada);
  assert.equal(resultado.status, "RELEASED");
  assert.equal(resultado.releasedAt?.toISOString(), "2026-09-02T13:00:00.000Z");
});

test("una consigna cerrada tampoco se reabre sola", () => {
  const cerrada = { status: "CLOSED" as const, releasedAt: new Date("2026-09-02T13:00:00Z") };
  assert.equal(estadoAlReprogramar(cerrada).status, "CLOSED");
});

test("una consigna que todavía no salió queda programada", () => {
  assert.deepEqual(estadoAlReprogramar({ status: "READY", releasedAt: null }), {
    status: "READY",
    releasedAt: null,
  });
  assert.deepEqual(estadoAlReprogramar(null), { status: "READY", releasedAt: null });
});
