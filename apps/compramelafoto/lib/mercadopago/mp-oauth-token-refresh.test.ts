import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isMercadoPagoUnauthorizedError,
  refreshMercadoPagoOwnerAccessTokenWithDeps,
  type MercadoPagoTokenOwner,
  type MercadoPagoTokenRecord,
  type MercadoPagoTokenStore,
} from "./mp-oauth-token-refresh";

const owner: MercadoPagoTokenOwner = { ownerType: "USER", ownerId: 195 };

function makeStore(record: MercadoPagoTokenRecord | null) {
  const saved: Array<{ accessToken: string; refreshToken: string | null; mpUserId: string | null }> =
    [];
  const store: MercadoPagoTokenStore = {
    async read() {
      return record;
    },
    async save(_owner, tokens) {
      saved.push(tokens);
    },
  };
  return { store, saved };
}

describe("isMercadoPagoUnauthorizedError", () => {
  it("detecta el 401 real de Mercado Pago", () => {
    const err = new Error(
      'Error creando preferencia en Mercado Pago: {"message":"invalid access token","error":"not_found","status":401}'
    );
    assert.equal(isMercadoPagoUnauthorizedError(err), true);
  });

  it("detecta el status expuesto en el error", () => {
    const err = Object.assign(new Error("boom"), { status: 401 });
    assert.equal(isMercadoPagoUnauthorizedError(err), true);
  });

  it("no confunde otros errores de Mercado Pago", () => {
    assert.equal(
      isMercadoPagoUnauthorizedError(
        new Error('Error creando preferencia en Mercado Pago: {"message":"invalid_items","status":400}')
      ),
      false
    );
    assert.equal(isMercadoPagoUnauthorizedError(new Error("El monto debe ser mayor a 0")), false);
  });
});

describe("refreshMercadoPagoOwnerAccessTokenWithDeps", () => {
  it("renueva y persiste el access token y el refresh token rotado", async () => {
    const { store, saved } = makeStore({ accessToken: "APP_USR-viejo", refreshToken: "TG-viejo" });
    const result = await refreshMercadoPagoOwnerAccessTokenWithDeps(owner, {
      store,
      async refresh(refreshToken) {
        assert.equal(refreshToken, "TG-viejo");
        return { access_token: "APP_USR-nuevo", refresh_token: "TG-nuevo", user_id: 285273221 };
      },
    });

    assert.deepEqual(result, {
      ok: true,
      accessToken: "APP_USR-nuevo",
      rotatedRefreshToken: true,
    });
    assert.deepEqual(saved, [
      { accessToken: "APP_USR-nuevo", refreshToken: "TG-nuevo", mpUserId: "285273221" },
    ]);
  });

  it("conserva el refresh token anterior si Mercado Pago no manda uno nuevo", async () => {
    const { store, saved } = makeStore({ accessToken: "APP_USR-viejo", refreshToken: "TG-viejo" });
    const result = await refreshMercadoPagoOwnerAccessTokenWithDeps(owner, {
      store,
      async refresh() {
        return { access_token: "APP_USR-nuevo" };
      },
    });

    assert.equal(result.ok, true);
    assert.equal(saved[0].refreshToken, "TG-viejo");
    assert.equal(saved[0].mpUserId, null);
  });

  it("falla sin guardar nada cuando no hay refresh token", async () => {
    const { store, saved } = makeStore({ accessToken: "APP_USR-viejo", refreshToken: null });
    const result = await refreshMercadoPagoOwnerAccessTokenWithDeps(owner, {
      store,
      async refresh() {
        throw new Error("no debería llamarse");
      },
    });

    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.code, "NO_REFRESH_TOKEN");
    assert.equal(saved.length, 0);
  });

  it("falla sin guardar nada cuando Mercado Pago rechaza el refresh", async () => {
    const { store, saved } = makeStore({ accessToken: "APP_USR-viejo", refreshToken: "TG-revocado" });
    const result = await refreshMercadoPagoOwnerAccessTokenWithDeps(owner, {
      store,
      async refresh() {
        throw new Error("invalid_grant");
      },
    });

    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.code, "REFRESH_REJECTED");
    assert.equal(saved.length, 0);
  });

  it("no guarda si el refresh devuelve una respuesta sin access_token", async () => {
    const { store, saved } = makeStore({ accessToken: "APP_USR-viejo", refreshToken: "TG-viejo" });
    const result = await refreshMercadoPagoOwnerAccessTokenWithDeps(owner, {
      store,
      async refresh() {
        return {} as any;
      },
    });

    assert.equal(result.ok, false);
    assert.equal(saved.length, 0);
  });
});
