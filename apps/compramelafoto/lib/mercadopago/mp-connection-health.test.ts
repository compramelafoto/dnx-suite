import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  canChargeWithMercadoPago,
  needsMercadoPagoReconnect,
  resolveMercadoPagoConnectionHealthWithDeps,
  type ProbeResult,
} from "./mp-connection-health";

function deps(opts: {
  token?: string | null;
  probe?: ProbeResult;
  refreshOk?: boolean;
  onRefresh?: () => void;
}) {
  return {
    readAccessToken: async () => (opts.token === undefined ? "APP_USR-x" : opts.token),
    probe: async () => opts.probe ?? "ALIVE",
    refresh: async () => {
      opts.onRefresh?.();
      return { ok: Boolean(opts.refreshOk) };
    },
  };
}

describe("estado de la conexión con Mercado Pago", () => {
  it("sin token guardado es NOT_CONNECTED y no consulta a Mercado Pago", async () => {
    let refreshed = false;
    const health = await resolveMercadoPagoConnectionHealthWithDeps(
      deps({ token: null, onRefresh: () => (refreshed = true) })
    );
    assert.equal(health.status, "NOT_CONNECTED");
    assert.equal(refreshed, false);
  });

  it("token vivo es CONNECTED sin renovar nada", async () => {
    let refreshed = false;
    const health = await resolveMercadoPagoConnectionHealthWithDeps(
      deps({ probe: "ALIVE", onRefresh: () => (refreshed = true) })
    );
    assert.deepEqual(health, { status: "CONNECTED", selfHealed: false });
    assert.equal(refreshed, false);
  });

  it("token vencido que se puede renovar queda CONNECTED y se marca como reparado solo", async () => {
    const health = await resolveMercadoPagoConnectionHealthWithDeps(
      deps({ probe: "UNAUTHORIZED", refreshOk: true })
    );
    assert.deepEqual(health, { status: "CONNECTED", selfHealed: true });
  });

  it("token vencido que tampoco se puede renovar es EXPIRED", async () => {
    const health = await resolveMercadoPagoConnectionHealthWithDeps(
      deps({ probe: "UNAUTHORIZED", refreshOk: false })
    );
    assert.equal(health.status, "EXPIRED");
  });

  it("si Mercado Pago no responde es UNKNOWN: no se alarma ni se renueva", async () => {
    let refreshed = false;
    const health = await resolveMercadoPagoConnectionHealthWithDeps(
      deps({ probe: "UNREACHABLE", onRefresh: () => (refreshed = true) })
    );
    assert.equal(health.status, "UNKNOWN");
    assert.equal(refreshed, false);
  });

  it("solo EXPIRED obliga a reconectar", () => {
    assert.equal(needsMercadoPagoReconnect("EXPIRED"), true);
    assert.equal(needsMercadoPagoReconnect("CONNECTED"), false);
    assert.equal(needsMercadoPagoReconnect("NOT_CONNECTED"), false);
    assert.equal(needsMercadoPagoReconnect("UNKNOWN"), false);
  });

  it("una falla nuestra no bloquea el cobro", () => {
    assert.equal(canChargeWithMercadoPago("UNKNOWN"), true);
    assert.equal(canChargeWithMercadoPago("CONNECTED"), true);
    assert.equal(canChargeWithMercadoPago("EXPIRED"), false);
    assert.equal(canChargeWithMercadoPago("NOT_CONNECTED"), false);
  });
});
