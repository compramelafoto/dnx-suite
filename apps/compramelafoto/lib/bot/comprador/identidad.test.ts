import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ getAuthUser: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getAuthUser: m.getAuthUser }));
import {
  ACTOR_MOTOR_COMPRADOR,
  cookieInvitado,
  emailVerificadoDe,
  GUEST_COOKIE,
  ipDe,
  leerGuestKey,
  nivelDe,
  nuevaGuestKey,
  sesionVerificada,
} from "./identidad";

beforeEach(() => { m.getAuthUser.mockReset(); });
afterEach(() => vi.unstubAllEnvs());

const CLAVE = "f".repeat(32);

describe("cookie del invitado", () => {
  it("lee la clave sólo si son 32 hex en minúscula", () => {
    expect(GUEST_COOKIE).toBe("dnxbot_guest");
    expect(leerGuestKey("a=1; dnxbot_guest=" + CLAVE)).toBe(CLAVE);
    expect(leerGuestKey("dnxbot_guest=" + CLAVE + "; b=2")).toBe(CLAVE);
    expect(leerGuestKey("dnxbot_guest=" + "F".repeat(32))).toBeNull();
    expect(leerGuestKey("dnxbot_guest=" + "f".repeat(31))).toBeNull();
    expect(leerGuestKey("dnxbot_guest=" + "f".repeat(33))).toBeNull();
    expect(leerGuestKey("dnxbot_guest=x; Path=/")).toBeNull();
    expect(leerGuestKey("otro_dnxbot_guest=" + CLAVE)).toBeNull();
    expect(leerGuestKey(null)).toBeNull();
    expect(leerGuestKey("")).toBeNull();
  });
  it("nuevaGuestKey son 32 hex y cambia cada vez", () => {
    const a = nuevaGuestKey();
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(nuevaGuestKey()).not.toBe(a);
  });
  it("cookieInvitado: un año, Lax, HttpOnly; Secure sólo en producción o Vercel", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("VERCEL", "");
    const c = cookieInvitado(CLAVE);
    expect(c).toBe(`dnxbot_guest=${CLAVE}; Path=/; Max-Age=31536000; SameSite=Lax; HttpOnly`);
    vi.stubEnv("VERCEL", "1");
    expect(cookieInvitado(CLAVE)).toBe(`${c}; Secure`);
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(cookieInvitado(CLAVE)).toContain("; Secure");
  });
});

describe("ipDe", () => {
  it("primero x-forwarded-for, después x-real-ip, si no unknown", () => {
    expect(ipDe(new Request("http://x", { headers: { "x-forwarded-for": " 1.1.1.1 , 2.2.2.2", "x-real-ip": "3.3.3.3" } }))).toBe("1.1.1.1");
    expect(ipDe(new Request("http://x", { headers: { "x-real-ip": "3.3.3.3" } }))).toBe("3.3.3.3");
    expect(ipDe(new Request("http://x"))).toBe("unknown");
  });
});

describe("nivel y verificación", () => {
  const enlace = { tipo: "descarga" as const, orderId: 1, albumId: 2 };
  it("nivelDe en los tres casos", () => {
    expect(nivelDe({ enlace: null, emailVerificado: null })).toBe("visitante");
    expect(nivelDe({ enlace, emailVerificado: null })).toBe("con_enlace");
    expect(nivelDe({ enlace, emailVerificado: "a@b.com" })).toBe("verificado");
    expect(nivelDe({ enlace: null, emailVerificado: "a@b.com" })).toBe("verificado");
  });
  it("emailVerificadoDe: sesión gana; código vigente sirve; vencido no", () => {
    const now = new Date("2026-10-12T15:00:00Z");
    const vigente = { buyerEmail: "c@d.com", verifiedUntil: new Date("2026-10-12T16:00:00Z") };
    const vencido = { buyerEmail: "c@d.com", verifiedUntil: new Date("2026-10-12T14:00:00Z") };
    expect(emailVerificadoDe(vigente, { email: "s@e.com" }, now)).toBe("s@e.com");
    expect(emailVerificadoDe(vigente, null, now)).toBe("c@d.com");
    expect(emailVerificadoDe(vencido, null, now)).toBeNull();
    expect(emailVerificadoDe({ buyerEmail: "c@d.com", verifiedUntil: now }, null, now)).toBeNull();
    expect(emailVerificadoDe({ buyerEmail: null, verifiedUntil: new Date("2026-10-12T16:00:00Z") }, null, now)).toBeNull();
    expect(emailVerificadoDe({ buyerEmail: "c@d.com", verifiedUntil: null }, null, now)).toBeNull();
  });
  it("sesionVerificada exige emailVerifiedAt y normaliza el mail", async () => {
    m.getAuthUser.mockResolvedValue({ id: 9, email: " Ana@X.com ", emailVerifiedAt: null });
    expect(await sesionVerificada()).toBeNull();
    m.getAuthUser.mockResolvedValue({ id: 9, email: " Ana@X.com ", emailVerifiedAt: new Date() });
    expect(await sesionVerificada()).toEqual({ email: "ana@x.com", userId: 9 });
    m.getAuthUser.mockResolvedValue(null);
    expect(await sesionVerificada()).toBeNull();
  });
  it("sesionVerificada ante un error devuelve null", async () => {
    m.getAuthUser.mockRejectedValue(new Error("sin cookies"));
    expect(await sesionVerificada()).toBeNull();
  });
  it("actor del motor para compradores", () => {
    expect(ACTOR_MOTOR_COMPRADOR).toEqual({ userId: 0, role: "BUYER", email: "", name: null });
  });
});
