import { describe, expect, it } from "vitest";
import {
  GoogleIntegrationError,
  buildIntegrationAuthorizationUrl,
  hasAllScopes,
  parseTokenResponse,
} from "./google-oauth";

describe("URL de autorización", () => {
  const base = {
    clientId: "cliente-123",
    redirectUri: "https://app.fotoffice.ar/api/integrations/google/callback",
    state: "estado-opaco",
    scopes: ["https://www.googleapis.com/auth/calendar.events"],
  };

  it("pide acceso sin conexión: sin eso Google no entrega refresh token", () => {
    const url = new URL(buildIntegrationAuthorizationUrl(base));
    expect(url.searchParams.get("access_type")).toBe("offline");
  });

  it("fuerza la pantalla de consentimiento, para que reconectar devuelva un refresh token nuevo", () => {
    const url = new URL(buildIntegrationAuthorizationUrl(base));
    expect(url.searchParams.get("prompt")).toBe("consent");
  });

  it("NO acumula permisos ya otorgados: cada integración pide lo suyo", () => {
    const url = new URL(buildIntegrationAuthorizationUrl(base));
    expect(url.searchParams.get("include_granted_scopes")).toBe("false");
  });

  it("lleva los permisos pedidos, el estado y la URL de retorno", () => {
    const url = new URL(buildIntegrationAuthorizationUrl(base));
    expect(url.searchParams.get("scope")).toContain("calendar.events");
    expect(url.searchParams.get("state")).toBe("estado-opaco");
    expect(url.searchParams.get("redirect_uri")).toBe(base.redirectUri);
    expect(url.searchParams.get("response_type")).toBe("code");
  });

  it("sugiere la cuenta cuando se está reconectando una ya conocida", () => {
    const url = new URL(buildIntegrationAuthorizationUrl({ ...base, loginHint: "sfpr@gmail.com" }));
    expect(url.searchParams.get("login_hint")).toBe("sfpr@gmail.com");
  });
});

describe("respuesta de token", () => {
  it("lee token, refresh, vencimiento y permisos otorgados", () => {
    const parsed = parseTokenResponse({
      access_token: "ya29.token",
      refresh_token: "1//refresh",
      expires_in: 3599,
      scope: "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly",
    });
    expect(parsed.accessToken).toBe("ya29.token");
    expect(parsed.refreshToken).toBe("1//refresh");
    expect(parsed.expiresInSeconds).toBe(3599);
    expect(parsed.grantedScopes).toHaveLength(2);
  });

  it("una renovación no trae refresh token, y eso es normal", () => {
    const parsed = parseTokenResponse({ access_token: "ya29.nuevo", expires_in: 3599 });
    expect(parsed.refreshToken).toBeNull();
    expect(parsed.grantedScopes).toEqual([]);
  });

  it("sin access_token la respuesta no sirve", () => {
    expect(() => parseTokenResponse({ expires_in: 3599 })).toThrow(GoogleIntegrationError);
    expect(() => parseTokenResponse(null)).toThrow(GoogleIntegrationError);
  });

  it("si no dice cuánto dura, se asume una hora", () => {
    expect(parseTokenResponse({ access_token: "ya29.x" }).expiresInSeconds).toBe(3600);
  });
});

describe("permisos otorgados", () => {
  it("Google puede dar menos de lo pedido, y hay que darse cuenta", () => {
    const pedidos = ["a", "b"];
    expect(hasAllScopes(["a"], pedidos)).toBe(false);
    expect(hasAllScopes(["a", "b"], pedidos)).toBe(true);
    expect(hasAllScopes(["a", "b", "c"], pedidos)).toBe(true);
    expect(hasAllScopes([], pedidos)).toBe(false);
  });
});
