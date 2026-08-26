import { describe, expect, it } from "vitest";
import { decideTokenUse, REFRESH_SKEW_MS } from "./token-freshness";

const ahora = new Date("2026-08-26T12:00:00.000Z");
const enMs = (ms: number) => new Date(ahora.getTime() + ms);

describe("decideTokenUse", () => {
  it("un token con horas por delante se usa tal cual", () => {
    expect(
      decideTokenUse({ expiresAt: enMs(6 * 60 * 60 * 1000), hasRefreshToken: true, now: ahora }),
    ).toBe("USE");
  });

  it("un token sin vencimiento declarado se usa, no se refresca", () => {
    // Refrescar rota el refresh token en MercadoPago: hacerlo sin necesidad es arriesgar
    // perder el acceso para ganar nada.
    expect(decideTokenUse({ expiresAt: null, hasRefreshToken: true, now: ahora })).toBe("USE");
  });

  it("un token que vence dentro del margen se refresca antes de usarlo", () => {
    expect(
      decideTokenUse({ expiresAt: enMs(REFRESH_SKEW_MS - 1000), hasRefreshToken: true, now: ahora }),
    ).toBe("REFRESH");
  });

  it("un token ya vencido se refresca", () => {
    expect(
      decideTokenUse({ expiresAt: enMs(-60 * 1000), hasRefreshToken: true, now: ahora }),
    ).toBe("REFRESH");
  });

  it("vencido y sin refresh token, no hay nada que hacer salvo reconectar", () => {
    expect(
      decideTokenUse({ expiresAt: enMs(-60 * 1000), hasRefreshToken: false, now: ahora }),
    ).toBe("CANNOT_REFRESH");
  });

  it("justo en el limite del margen se refresca, no se arriesga", () => {
    expect(
      decideTokenUse({ expiresAt: enMs(REFRESH_SKEW_MS), hasRefreshToken: true, now: ahora }),
    ).toBe("REFRESH");
  });
});
