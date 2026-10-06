import { describe, expect, it } from "vitest";
import { diaYHora } from "./labels";
import {
  decideSharedDestination,
  isValidSharedParams,
  meetingShareMessage,
  projectShareMessage,
  sharedReturnPath,
  sharedUrl,
} from "./share";

describe("sharedUrl", () => {
  it("usa el dominio propio cuando está conectado", () => {
    expect(sharedUrl({ kind: "proyecto", slug: "sfpr", id: "abc", appOrigin: "https://fotoffice.com", customDomain: "sfpr.com.ar" })).toBe(
      "https://sfpr.com.ar/proyecto/abc",
    );
  });
  it("sin dominio, el de FOTOFFICE con la institución", () => {
    expect(sharedUrl({ kind: "reunion", slug: "sfpr", id: "abc", appOrigin: "https://fotoffice.com" })).toBe(
      "https://fotoffice.com/w/sfpr/reunion/abc",
    );
  });
});

describe("sharedReturnPath", () => {
  it("acepta sólo la forma exacta", () => {
    expect(sharedReturnPath("/w/sfpr/proyecto/cmabc123")).toBe("/w/sfpr/proyecto/cmabc123");
    expect(sharedReturnPath(" /w/sfpr/reunion/cmabc123 ")).toBe("/w/sfpr/reunion/cmabc123");
  });
  it("rechaza todo lo demás", () => {
    for (const malo of [
      null,
      "",
      "/w/sfpr/proyecto/",
      "/w/sfpr/proyecto/abc?x=1",
      "/w/sfpr/proyecto/abc/extra",
      "//evil.com/w/sfpr/proyecto/abc",
      "/w/../proyecto/abc",
      "/w/sfpr/otra/abc",
      "https://evil.com/w/sfpr/proyecto/abc",
    ]) {
      expect(sharedReturnPath(malo)).toBeNull();
    }
  });
});

describe("isValidSharedParams", () => {
  it("filtra slugs e ids raros", () => {
    expect(isValidSharedParams("sfpr", "cmabc123")).toBe(true);
    expect(isValidSharedParams("SFPR", "cmabc123")).toBe(false);
    expect(isValidSharedParams("sfpr", "abc.def")).toBe(false);
  });
});

describe("decideSharedDestination", () => {
  it("la comisión va al panel aunque también sea socia", () => {
    expect(
      decideSharedDestination({ kind: "proyecto", id: "p1", viewer: { commission: true, memberId: "m1" }, memberCanSee: true }),
    ).toEqual({ kind: "panel", path: "/gobierno/p1" });
    expect(
      decideSharedDestination({ kind: "reunion", id: "r1", viewer: { commission: true, memberId: null }, memberCanSee: false }),
    ).toEqual({ kind: "panel", path: "/gobierno/reuniones/r1" });
  });
  it("el socio ve su versión si el proyecto es visible", () => {
    expect(
      decideSharedDestination({ kind: "proyecto", id: "p1", viewer: { commission: false, memberId: "m1" }, memberCanSee: true }),
    ).toEqual({ kind: "portal", path: "/portal/proyectos/p1", memberWorkspace: true });
  });
  it("al socio se le explica cuando es interno o es una reunión", () => {
    expect(
      decideSharedDestination({ kind: "proyecto", id: "p1", viewer: { commission: false, memberId: "m1" }, memberCanSee: false }),
    ).toMatchObject({ path: "/portal/proyectos?aviso=interno" });
    expect(
      decideSharedDestination({ kind: "reunion", id: "r1", viewer: { commission: false, memberId: "m1" }, memberCanSee: false }),
    ).toMatchObject({ path: "/portal/proyectos?aviso=reunion" });
  });
  it("quien no es nada de la institución vuelve a la puerta", () => {
    expect(
      decideSharedDestination({ kind: "proyecto", id: "p1", viewer: { commission: false, memberId: null }, memberCanSee: false }),
    ).toEqual({ kind: "door" });
  });
});

describe("mensajes", () => {
  it("el del proyecto pide votar antes de la reunión", () => {
    const m = projectShareMessage({ title: "Muestra", url: "https://x/p", votingOpen: true, nextMeeting: "jueves 15/10" });
    expect(m).toContain('"Muestra"');
    expect(m).toContain("antes de la reunión del jueves 15/10");
    expect(m.endsWith("https://x/p")).toBe(true);
  });
  it("con la votación cerrada sólo invita a verlo", () => {
    expect(projectShareMessage({ title: "Muestra", url: "u", votingOpen: false })).toContain("Entren a verlo.");
  });
  it("el de la reunión lista el temario numerado", () => {
    const m = meetingShareMessage({ title: "Reunión de comisión", when: "jueves 15/10, 19:00", location: "Sede", topics: ["A", "B"], url: "u" });
    expect(m).toContain("1. A\n2. B");
    expect(m).toContain("· Sede");
  });
});

describe("diaYHora", () => {
  it("escribe el día y la hora argentinos", () => {
    // 15/10/2026 22:00 UTC = jueves 15/10 19:00 en Argentina.
    const d = new Date("2026-10-15T22:00:00Z");
    expect(diaYHora(d)).toBe("jueves 15/10, 19:00");
    expect(diaYHora(d, false)).toBe("jueves 15/10");
  });
});
