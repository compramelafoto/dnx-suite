import { describe, expect, it } from "vitest";
import {
  buildInvitationUrl,
  canMemberUseInvitations,
  emailsMatch,
  generateInvitationToken,
  hashInvitationToken,
  INVITATION_TTL_HOURS,
  invitationExpiryFrom,
  invitationState,
  invitationTokenMatches,
  isInvitationUsable,
} from "./invitations";

describe("token", () => {
  it("cada token es distinto", () => {
    const tokens = new Set(Array.from({ length: 200 }, () => generateInvitationToken()));
    expect(tokens.size).toBe(200);
  });

  it("tiene entropía suficiente y es seguro dentro de una URL", () => {
    const t = generateInvitationToken();
    expect(t.length).toBeGreaterThanOrEqual(42);
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("el hash es determinístico", () => {
    const t = generateInvitationToken();
    expect(hashInvitationToken(t)).toBe(hashInvitationToken(t));
  });

  it("el hash NO permite recuperar el token", () => {
    const t = generateInvitationToken();
    const h = hashInvitationToken(t);
    expect(h).not.toContain(t);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it("tokens distintos producen hashes distintos", () => {
    expect(hashInvitationToken("a")).not.toBe(hashInvitationToken("b"));
  });

  it("la comparación acepta el token correcto y rechaza el incorrecto", () => {
    const t = generateInvitationToken();
    const h = hashInvitationToken(t);
    expect(invitationTokenMatches(t, h)).toBe(true);
    expect(invitationTokenMatches(generateInvitationToken(), h)).toBe(false);
  });

  it("un hash malformado no rompe: devuelve false", () => {
    expect(invitationTokenMatches("x", "no-es-hex")).toBe(false);
    expect(invitationTokenMatches("x", "")).toBe(false);
  });
});

describe("vigencia", () => {
  it("vence a las 72 horas", () => {
    const now = new Date("2026-08-21T10:00:00Z");
    const exp = invitationExpiryFrom(now);
    expect(exp.getTime() - now.getTime()).toBe(INVITATION_TTL_HOURS * 60 * 60 * 1000);
    expect(INVITATION_TTL_HOURS).toBe(72);
  });
});

describe("estado derivado (no hay columna de estado que pueda desincronizarse)", () => {
  const future = new Date("2026-12-31T00:00:00Z");
  const past = new Date("2020-01-01T00:00:00Z");
  const now = new Date("2026-08-21T10:00:00Z");

  it("pendiente: sin aceptar, sin revocar y vigente", () => {
    expect(invitationState({ acceptedAt: null, revokedAt: null, expiresAt: future }, now)).toBe("PENDING");
  });

  it("aceptada gana sobre cualquier otro estado", () => {
    expect(
      invitationState({ acceptedAt: now, revokedAt: now, expiresAt: past }, now),
    ).toBe("ACCEPTED");
  });

  it("revocada", () => {
    expect(invitationState({ acceptedAt: null, revokedAt: now, expiresAt: future }, now)).toBe("REVOKED");
  });

  it("vencida", () => {
    expect(invitationState({ acceptedAt: null, revokedAt: null, expiresAt: past }, now)).toBe("EXPIRED");
  });

  it("justo en el instante de vencimiento ya NO sirve", () => {
    expect(invitationState({ acceptedAt: null, revokedAt: null, expiresAt: now }, now)).toBe("EXPIRED");
  });

  it("solo una invitación PENDING es utilizable", () => {
    expect(isInvitationUsable({ acceptedAt: null, revokedAt: null, expiresAt: future }, now)).toBe(true);
    expect(isInvitationUsable({ acceptedAt: now, revokedAt: null, expiresAt: future }, now)).toBe(false);
    expect(isInvitationUsable({ acceptedAt: null, revokedAt: now, expiresAt: future }, now)).toBe(false);
    expect(isInvitationUsable({ acceptedAt: null, revokedAt: null, expiresAt: past }, now)).toBe(false);
  });
});

describe("coincidencia de email", () => {
  it("ignora mayúsculas y espacios", () => {
    expect(emailsMatch(" Socio@X.com ", "socio@x.com")).toBe(true);
  });

  it("emails distintos no coinciden", () => {
    expect(emailsMatch("a@x.com", "b@x.com")).toBe(false);
  });

  it("la ausencia NUNCA coincide: sin email no se autoriza nada", () => {
    expect(emailsMatch(null, null)).toBe(false);
    expect(emailsMatch("", "")).toBe(false);
    expect(emailsMatch("a@x.com", null)).toBe(false);
    expect(emailsMatch(null, "a@x.com")).toBe(false);
  });
});

describe("enlace de invitación", () => {
  const OK = { APP_URL: "https://fotoffice.com" };

  it("se arma absoluto sobre APP_URL", () => {
    expect(buildInvitationUrl("abc", OK)).toEqual({
      ok: true,
      url: "https://fotoffice.com/invitacion/abc",
    });
  });

  it("no duplica la barra final", () => {
    expect(buildInvitationUrl("abc", { APP_URL: "https://fotoffice.com/" })).toEqual({
      ok: true,
      url: "https://fotoffice.com/invitacion/abc",
    });
  });

  it("el token se escapa dentro de la URL", () => {
    const r = buildInvitationUrl("a/b?c", OK);
    expect(r).toEqual({ ok: true, url: "https://fotoffice.com/invitacion/a%2Fb%3Fc" });
  });

  it("un token real no necesita escape (base64url ya es seguro)", () => {
    const t = generateInvitationToken();
    expect(buildInvitationUrl(t, OK)).toEqual({
      ok: true,
      url: `https://fotoffice.com/invitacion/${t}`,
    });
  });

  /**
   * Sin base absoluta el enlace saldría relativo y el email sería inservible. Antes eso pasaba
   * en silencio: `APP_URL` no existe en producción y la invitación se presentaba como creada.
   */
  it.each([
    ["ausente", {}],
    ["vacía", { APP_URL: "   " }],
    ["relativa", { APP_URL: "/fotoffice" }],
    ["sin esquema", { APP_URL: "fotoffice.com" }],
    ["con esquema no http", { APP_URL: "javascript:alert(1)" }],
  ])("APP_URL %s devuelve CONFIGURATION_ERROR, nunca una URL relativa", (_label, env) => {
    expect(buildInvitationUrl("abc", env)).toEqual({ ok: false, reason: "CONFIGURATION_ERROR" });
  });

  it("no usa NEXT_PUBLIC_APP_URL como respaldo", () => {
    expect(buildInvitationUrl("abc", { NEXT_PUBLIC_APP_URL: "https://otro.com" })).toEqual({
      ok: false,
      reason: "CONFIGURATION_ERROR",
    });
  });
});

describe("estado del socio habilitado para invitar y aceptar", () => {
  it("solo ACTIVE", () => {
    expect(canMemberUseInvitations("ACTIVE")).toBe(true);
  });

  it.each(["SUSPENDED", "INACTIVE"] as const)("%s queda afuera", (status) => {
    expect(canMemberUseInvitations(status)).toBe(false);
  });

  /** Los valores son los tres del enum `MemberStatus`; no se inventan estados nuevos. */
  it("no acepta un estado que no exista en el enum", () => {
    expect(canMemberUseInvitations("HABILITADO" as never)).toBe(false);
  });
});
