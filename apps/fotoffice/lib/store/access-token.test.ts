import { describe, expect, it } from "vitest";
import {
  accessTokenMatches,
  hashAccessToken,
  newPublicId,
  orderAccessToken,
  resolveOrderTokenKey,
} from "./access-token";

describe("token de acceso", () => {
  it("el público empieza con ped_ y no se repite", () => {
    const a = newPublicId();
    const b = newPublicId();
    expect(a).toMatch(/^ped_[a-z2-7]{12}$/);
    expect(a).not.toBe(b);
  });
  it("es determinista: mismo pedido y misma clave dan el mismo token", () => {
    expect(orderAccessToken("ped_abc", "k1")).toBe(orderAccessToken("ped_abc", "k1"));
  });
  it("cambia con otro pedido o con otra clave", () => {
    const t = orderAccessToken("ped_abc", "k1");
    expect(orderAccessToken("ped_abd", "k1")).not.toBe(t);
    expect(orderAccessToken("ped_abc", "k2")).not.toBe(t);
  });
  it("es base64url", () => {
    expect(orderAccessToken("ped_abc", "k1")).toMatch(/^[A-Za-z0-9_-]+$/);
  });
  it("verifica el token propio contra su hash y rechaza otro", () => {
    const t = orderAccessToken("ped_abc", "k1");
    const h = hashAccessToken(t);
    expect(accessTokenMatches(t, h)).toBe(true);
    expect(accessTokenMatches(orderAccessToken("ped_xyz", "k1"), h)).toBe(false);
    expect(accessTokenMatches("", h)).toBe(false);
  });
});

describe("resolveOrderTokenKey", () => {
  it("prioriza STORE_ORDER_TOKEN_SECRET, después FOTOFFICE_CRON_SECRET y por último CRON_SECRET", () => {
    expect(resolveOrderTokenKey({ STORE_ORDER_TOKEN_SECRET: "a", FOTOFFICE_CRON_SECRET: "b", CRON_SECRET: "c" })).toBe("a");
    expect(resolveOrderTokenKey({ FOTOFFICE_CRON_SECRET: "b", CRON_SECRET: "c" })).toBe("b");
    expect(resolveOrderTokenKey({ CRON_SECRET: "c" })).toBe("c");
  });
  it("saltea las vacías", () => {
    expect(resolveOrderTokenKey({ STORE_ORDER_TOKEN_SECRET: "", CRON_SECRET: "c" })).toBe("c");
  });
  it("devuelve null si no hay ninguna", () => {
    expect(resolveOrderTokenKey({})).toBeNull();
  });
  it("recorta espacios y trata un valor de puros espacios como vacío", () => {
    expect(resolveOrderTokenKey({ STORE_ORDER_TOKEN_SECRET: "  a  ", CRON_SECRET: "c" })).toBe("a");
    expect(resolveOrderTokenKey({ STORE_ORDER_TOKEN_SECRET: "   ", FOTOFFICE_CRON_SECRET: " b " })).toBe("b");
    expect(resolveOrderTokenKey({ STORE_ORDER_TOKEN_SECRET: " \t\n" })).toBeNull();
  });
  it("en producción sólo vale STORE_ORDER_TOKEN_SECRET: el secreto del cron no la reemplaza", () => {
    const prod = { VERCEL_ENV: "production" };
    expect(resolveOrderTokenKey({ ...prod, STORE_ORDER_TOKEN_SECRET: "a", CRON_SECRET: "c" })).toBe("a");
    expect(resolveOrderTokenKey({ ...prod, FOTOFFICE_CRON_SECRET: "b", CRON_SECRET: "c" })).toBeNull();
    expect(resolveOrderTokenKey({ ...prod, STORE_ORDER_TOKEN_SECRET: "  ", CRON_SECRET: "c" })).toBeNull();
  });
  it("en preview sigue aceptando el secreto del cron como reemplazo", () => {
    expect(resolveOrderTokenKey({ VERCEL_ENV: "preview", CRON_SECRET: "c" })).toBe("c");
  });
});
