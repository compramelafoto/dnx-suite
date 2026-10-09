import { describe, expect, it } from "vitest";
import { dayEndAr, dayStartAr } from "./dates";
import {
  freeProfileSlug, normalizeInstagram, normalizeProfileSlug, normalizeWebsite, profileSlugBase, profileSlugProblem,
  profileWorksInActivity, resolveAuthorProfileId, sameName,
} from "./profile";

describe("slug del perfil", () => {
  it("sale del nombre, sin acentos", () => expect(profileSlugBase("José María Pérez")).toBe("jose-maria-perez"));
  it("un nombre muy corto se completa", () => expect(profileSlugBase("Al")).toBe("al-foto"));
  it("un nombre sin letras usables da uno genérico", () => expect(profileSlugBase("¡¡¡")).toBe("fotografo"));
  it("una palabra reservada se completa", () => expect(profileSlugBase("Panel")).toBe("panel-foto"));
  it("se corta en 40 sin guion final", () => {
    const s = profileSlugBase("Ana ".repeat(20));
    expect(s.length).toBeLessThanOrEqual(40);
    expect(s.endsWith("-")).toBe(false);
  });
  it("normaliza lo que escribe la persona", () => expect(normalizeProfileSlug("  Ana Pérez ")).toBe("ana-perez"));
  it("explica qué está mal", () => {
    expect(profileSlugProblem("ab")).toMatch(/entre 3 y 40/);
    expect(profileSlugProblem("ana--perez")).toMatch(/letras sin acentos/);
    expect(profileSlugProblem("panel")).toMatch(/reservada/);
    expect(profileSlugProblem("ana-perez")).toBeNull();
  });
  it("busca el primero libre", () => {
    expect(freeProfileSlug("ana", new Set())).toBe("ana");
    expect(freeProfileSlug("ana", new Set(["ana", "ana-2"]))).toBe("ana-3");
    const largo = "a".repeat(40);
    expect(freeProfileSlug(largo, new Set([largo]))).toBe(`${"a".repeat(38)}-2`);
  });
});

describe("enlaces del perfil", () => {
  it("Instagram acepta @usuario y la URL del perfil", () => {
    expect(normalizeInstagram("@Ana.Perez")).toBe("ana.perez");
    expect(normalizeInstagram("https://www.instagram.com/ana_perez/?hl=es")).toBe("ana_perez");
    expect(normalizeInstagram("instagram.com/ana")).toBe("ana");
    expect(normalizeInstagram("m.instagram.com/ana")).toBe("ana");
    expect(normalizeInstagram("https://m.instagram.com/Ana/")).toBe("ana");
    expect(normalizeInstagram("con espacio")).toBeNull();
    expect(normalizeInstagram("  ")).toBeNull();
  });
  it("el sitio web se completa con https y descarta lo que no es web", () => {
    expect(normalizeWebsite("ejemplo.com")).toBe("https://ejemplo.com/");
    expect(normalizeWebsite("http://ejemplo.com/obra")).toBe("http://ejemplo.com/obra");
    expect(normalizeWebsite("javascript:alert(1)")).toBeNull();
    expect(normalizeWebsite("ftp://ejemplo.com")).toBeNull();
    expect(normalizeWebsite("localhost")).toBeNull();
    expect(normalizeWebsite("https://user:clave@ejemplo.com")).toBeNull();
    expect(normalizeWebsite("user@ejemplo.com")).toBeNull();
  });
});

describe("vínculo de una obra con un perfil", () => {
  const propio = { id: "p-ana", displayName: "Ana Pérez" };
  it("compara nombres sin mayúsculas, acentos ni espacios de más", () => {
    expect(sameName("  ANA   perez", "Ana Pérez")).toBe(true);
    expect(sameName("", "")).toBe(false);
  });
  it("respeta un perfil pedido que existe", () => {
    expect(resolveAuthorProfileId({ isNew: false, authorName: "x", requestedProfileId: "p-otro" }, new Set(["p-otro"]), propio)).toBe("p-otro");
  });
  it("descarta un perfil pedido que no existe", () => {
    expect(resolveAuthorProfileId({ isNew: true, authorName: "Ana Pérez", requestedProfileId: "p-falso" }, new Set(), propio)).toBeNull();
  });
  it("una obra nueva con el nombre del perfil propio se vincula sola", () => {
    expect(resolveAuthorProfileId({ isNew: true, authorName: "ana perez", requestedProfileId: null }, new Set(), propio)).toBe("p-ana");
  });
  it("una obra que ya existía no se vuelve a vincular sola (respeta un desvínculo)", () => {
    expect(resolveAuthorProfileId({ isNew: false, authorName: "Ana Pérez", requestedProfileId: null }, new Set(), propio)).toBeNull();
  });
  it("otro nombre queda como texto libre", () => {
    expect(resolveAuthorProfileId({ isNew: true, authorName: "Luis Gómez", requestedProfileId: null }, new Set(), propio)).toBeNull();
  });
});

describe("obras de un perfil en una muestra", () => {
  const a = { galleryMode: "HIGHLIGHTS_UNTIL_CLOSED", startsAt: dayStartAr("2026-11-05"), endsAt: dayEndAr("2026-11-20") };
  const obras = [
    { id: "w1", isHighlight: true, sortOrder: 0, authorProfileId: "p" },
    { id: "w2", isHighlight: false, sortOrder: 1, authorProfileId: "p" },
    { id: "w3", isHighlight: true, sortOrder: 2, authorProfileId: "otro" },
  ];
  it("abierta: muestra sólo lo que la galería deja ver y cuenta el resto", () => {
    const r = profileWorksInActivity(a, obras, "p", new Date("2026-11-10T15:00:00Z"));
    expect(r.visible.map((w) => w.id)).toEqual(["w1"]);
    expect(r.hiddenCount).toBe(1);
  });
  it("cerrada: todas las suyas", () => {
    const r = profileWorksInActivity(a, obras, "p", new Date("2026-11-25T15:00:00Z"));
    expect(r.visible.map((w) => w.id)).toEqual(["w1", "w2"]);
    expect(r.hiddenCount).toBe(0);
  });
});
