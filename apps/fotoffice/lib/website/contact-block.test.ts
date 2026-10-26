import { describe, expect, it } from "vitest";
import { createEmptyBlock, parseWebsiteSections, websiteBlockSchema, type ContactBlockConfig } from "./blocks";
import { hasVisibleContact } from "./dynamic-data";
import { resolveContactConfig, whatsappHref } from "./contact";

const wrap = (config: unknown) => ({ id: "c", type: "CONTACT", visible: true, order: 0, config });

describe("whatsappHref", () => {
  it("número argentino sin código de país ni 9 → wa.me/549…", () => {
    expect(whatsappHref("341 341-9869")).toBe("https://wa.me/5493413419869");
    expect(whatsappHref("0341 341-9869")).toBe("https://wa.me/5493413419869");
  });

  it("con +54 9 deja pasar; con +54 sin 9 lo agrega", () => {
    expect(whatsappHref("+54 9 341 374-8324", "Hola")).toBe("https://wa.me/5493413748324?text=Hola");
    expect(whatsappHref("+54 341 374-8324")).toBe("https://wa.me/5493413748324");
  });

  it("otro código de país pasa tal cual; el texto se codifica", () => {
    expect(whatsappHref("+598 99 123 456")).toBe("https://wa.me/59899123456");
    expect(whatsappHref("341 341-9869", "Hola, ¿qué tal?")).toBe("https://wa.me/5493413419869?text=Hola%2C%20%C2%BFqu%C3%A9%20tal%3F");
  });

  it("vacío o sin dígitos suficientes → null", () => {
    expect(whatsappHref("")).toBeNull();
    expect(whatsappHref("no hay")).toBeNull();
    expect(whatsappHref("123")).toBeNull();
  });
});

describe("bloque CONTACT", () => {
  it("nace usando los datos de la institución, sin redes", () => {
    const block = createEmptyBlock("CONTACT", 0);
    expect(websiteBlockSchema.safeParse(block).success).toBe(true);
    expect(block.config).toMatchObject({ useWorkspaceData: true, socials: [] });
  });

  it("mapsUrl que no es de Google Maps se descarta al parsear; las válidas se conservan", () => {
    const parse = (mapsUrl: string) =>
      (websiteBlockSchema.parse(wrap({ useWorkspaceData: false, socials: [], mapsUrl })).config as ContactBlockConfig).mapsUrl;
    expect(parse("https://maps.app.goo.gl/abc123")).toBe("https://maps.app.goo.gl/abc123");
    expect(parse("https://www.google.com/maps/place/Rosario")).toBe("https://www.google.com/maps/place/Rosario");
    expect(parse("https://evil.com/maps")).toBeUndefined();
    expect(parse("http://maps.app.goo.gl/abc123")).toBeUndefined();
    expect(parse("https://www.google.com/search?q=x")).toBeUndefined();
    expect(parse("javascript:alert(1)")).toBeUndefined();
  });

  it("una red social desconocida descarta el bloque; sobrevive a la lectura tolerante si es válido", () => {
    const ok = wrap({ useWorkspaceData: true, socials: [{ network: "instagram", url: "https://instagram.com/x" }] });
    expect(parseWebsiteSections({ pages: { home: [ok] } }).pages.home).toHaveLength(1);
    const bad = wrap({ useWorkspaceData: true, socials: [{ network: "myspace", url: "https://x" }] });
    expect(parseWebsiteSections({ pages: { home: [bad] } }).pages.home).toHaveLength(0);
  });

  it("hasVisibleContact: sólo cuenta los visibles", () => {
    const visible = createEmptyBlock("CONTACT", 0);
    expect(hasVisibleContact([visible])).toBe(true);
    expect(hasVisibleContact([{ ...visible, visible: false }, createEmptyBlock("TEXT", 1)])).toBe(false);
  });
});

describe("resolveContactConfig — completa los campos vacíos con los datos de la institución", () => {
  const workspace = {
    email: "hola@sfpr.test",
    phone: "341 111-2222",
    whatsapp: "3413419869",
    instagram: "@sfpr",
    city: "Rosario",
    province: "Santa Fe",
    legalNote: null,
  };
  const base: ContactBlockConfig = { useWorkspaceData: true, socials: [] };

  it("con useWorkspaceData, lo vacío se completa y lo escrito a mano manda", () => {
    const r = resolveContactConfig({ ...base, email: "otro@x.test" }, workspace);
    expect(r.email).toBe("otro@x.test");
    expect(r.phone).toBe("341 111-2222");
    expect(r.whatsapp).toBe("3413419869");
    expect(r.address).toBe("Rosario, Santa Fe");
    expect(r.socials).toEqual([{ network: "instagram", url: "https://instagram.com/sfpr" }]);
  });

  it("sin useWorkspaceData no se toma nada de la institución", () => {
    const r = resolveContactConfig({ ...base, useWorkspaceData: false }, workspace);
    expect([r.email, r.phone, r.whatsapp, r.address]).toEqual([undefined, undefined, undefined, undefined]);
    expect(r.socials).toEqual([]);
  });

  it("no duplica Instagram si ya está cargado a mano, y sin datos de la institución no rompe", () => {
    const own = { network: "instagram" as const, url: "https://instagram.com/mio" };
    expect(resolveContactConfig({ ...base, socials: [own] }, workspace).socials).toEqual([own]);
    const sinDatos = resolveContactConfig(base, undefined);
    expect(sinDatos.email).toBeUndefined();
    expect(sinDatos.socials).toEqual([]);
  });
});
