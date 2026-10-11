import { describe, expect, it } from "vitest";
import { withoutMpTokens } from "./without-mp-tokens";

describe("withoutMpTokens", () => {
  it("saca los dos tokens y deja mpConnected", () => {
    const out = withoutMpTokens({ id: 1, mpAccessToken: "a", mpRefreshToken: "r", mpUserId: "9" });
    expect(out).toEqual({ id: 1, mpUserId: "9", mpConnected: true });
  });

  it("token nulo es no conectado", () => {
    expect(withoutMpTokens({ id: 1, mpAccessToken: null })).toEqual({ id: 1, mpConnected: false });
  });

  it("si la consulta no trajo el token, no afirma ni niega la conexión", () => {
    expect(withoutMpTokens({ id: 1 })).toEqual({ id: 1 });
  });
});
