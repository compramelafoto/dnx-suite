import { describe, expect, it } from "vitest";
import { hostWithoutPort, normalizeDomainInput } from "./normalize";

describe("normalizeDomainInput", () => {
  it("acepta lo que la gente pega y lo deja en el dominio raíz", () => {
    expect(normalizeDomainInput("sfpr.com.ar")).toEqual({ ok: true, domain: "sfpr.com.ar" });
    expect(normalizeDomainInput("  https://www.SFPR.com.ar/inicio?x=1 ")).toEqual({ ok: true, domain: "sfpr.com.ar" });
    expect(normalizeDomainInput("http://sfpr.com.ar:443/")).toEqual({ ok: true, domain: "sfpr.com.ar" });
    expect(normalizeDomainInput("mi-estudio.com")).toEqual({ ok: true, domain: "mi-estudio.com" });
  });

  it("rechaza lo que no es un dominio", () => {
    expect(normalizeDomainInput("").ok).toBe(false);
    expect(normalizeDomainInput("sfpr").ok).toBe(false);
    expect(normalizeDomainInput("sfpr .com.ar").ok).toBe(false);
    expect(normalizeDomainInput("-sfpr.com.ar").ok).toBe(false);
    expect(normalizeDomainInput("192.168.0.1").ok).toBe(false);
  });

  it("no deja conectar dominios de la plataforma", () => {
    expect(normalizeDomainInput("algo.vercel.app").ok).toBe(false);
    expect(normalizeDomainInput("fotoffice.com.ar", ["fotoffice.com.ar"]).ok).toBe(false);
    expect(normalizeDomainInput("www.fotoffice.com.ar", ["fotoffice.com.ar"]).ok).toBe(false);
  });
});

describe("hostWithoutPort", () => {
  it("saca puerto, punto final y mayúsculas", () => {
    expect(hostWithoutPort("SFPR.com.ar:443")).toBe("sfpr.com.ar");
    expect(hostWithoutPort("sfpr.com.ar.")).toBe("sfpr.com.ar");
  });
});
