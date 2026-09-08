import { beforeEach, describe, expect, it, vi } from "vitest";

const readRefreshToken = vi.fn();
const markIntegrationNeedsReconsent = vi.fn();
const touchIntegrationUsed = vi.fn();
const refreshIntegrationAccessToken = vi.fn();

vi.mock("./store", () => ({
  readRefreshToken: (...a: unknown[]) => readRefreshToken(...a),
  markIntegrationNeedsReconsent: (...a: unknown[]) => markIntegrationNeedsReconsent(...a),
  touchIntegrationUsed: (...a: unknown[]) => touchIntegrationUsed(...a),
}));

vi.mock("./google-oauth", async () => {
  const actual = await vi.importActual<typeof import("./google-oauth")>("./google-oauth");
  return {
    ...actual,
    refreshIntegrationAccessToken: (...a: unknown[]) => refreshIntegrationAccessToken(...a),
  };
});

import { GoogleIntegrationError } from "./google-oauth";
import { getGoogleAccessToken } from "./access-token";

describe("token de acceso para los consumidores", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Las funciones reales devuelven promesas y el código les encadena `.catch`.
    // Un `vi.fn()` pelado devuelve undefined y rompería por una razón que no existe
    // en producción.
    markIntegrationNeedsReconsent.mockResolvedValue(undefined);
    touchIntegrationUsed.mockResolvedValue(undefined);
    process.env.GOOGLE_CLIENT_ID = "cliente";
    process.env.GOOGLE_CLIENT_SECRET = "secreto";
  });

  it("sin integración conectada lo dice, no explota", async () => {
    readRefreshToken.mockResolvedValue(null);
    expect(await getGoogleAccessToken("ws-1", "google-calendar")).toEqual({
      ok: false,
      reason: "NOT_CONNECTED",
    });
  });

  it("con integración conectada devuelve un token nuevo", async () => {
    readRefreshToken.mockResolvedValue("1//refresh");
    refreshIntegrationAccessToken.mockResolvedValue({
      accessToken: "ya29.nuevo",
      refreshToken: null,
      expiresInSeconds: 3599,
      grantedScopes: [],
    });
    expect(await getGoogleAccessToken("ws-1", "google-calendar")).toEqual({
      ok: true,
      accessToken: "ya29.nuevo",
    });
    expect(touchIntegrationUsed).toHaveBeenCalledWith("ws-1", "google-calendar");
  });

  it("si el permiso fue revocado, la integración queda marcada para reconectar", async () => {
    readRefreshToken.mockResolvedValue("1//viejo");
    refreshIntegrationAccessToken.mockRejectedValue(
      new GoogleIntegrationError("INVALID_GRANT", "ya no vale"),
    );
    expect(await getGoogleAccessToken("ws-1", "google-calendar")).toEqual({
      ok: false,
      reason: "NEEDS_RECONSENT",
    });
    expect(markIntegrationNeedsReconsent).toHaveBeenCalledWith("ws-1", "google-calendar");
  });

  it("si Google está caído, no se marca nada: el permiso sigue siendo válido", async () => {
    readRefreshToken.mockResolvedValue("1//refresh");
    refreshIntegrationAccessToken.mockRejectedValue(new Error("network"));
    expect(await getGoogleAccessToken("ws-1", "google-calendar")).toEqual({
      ok: false,
      reason: "UNAVAILABLE",
    });
    expect(markIntegrationNeedsReconsent).not.toHaveBeenCalled();
  });

  it("sin credenciales de la aplicación configuradas lo dice sin llamar a Google", async () => {
    delete process.env.GOOGLE_CLIENT_ID;
    readRefreshToken.mockResolvedValue("1//refresh");
    expect(await getGoogleAccessToken("ws-1", "google-calendar")).toEqual({
      ok: false,
      reason: "CONFIG",
    });
    expect(refreshIntegrationAccessToken).not.toHaveBeenCalled();
  });

  it("una clave desconocida del catálogo no consulta la base", async () => {
    expect(await getGoogleAccessToken("ws-1", "no-existe")).toEqual({
      ok: false,
      reason: "NOT_CONNECTED",
    });
    expect(readRefreshToken).not.toHaveBeenCalled();
  });
});
