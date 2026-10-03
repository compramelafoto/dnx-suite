import { describe, expect, it } from "vitest";
import { ContentError } from "@repo/content";
import {
  contentErrorStatus,
  mensajeDeRelacion,
  parseListLimit,
  parseUploadKind,
  readOptionalText,
  stripClientScope,
  trimOptionalFormValue,
} from "./admin-utils";
import { blogAdminSectionFor, isBlogNavActive, isWebsiteNavActive, isDomainNavActive } from "./admin-nav";
import { toDateInputValueAr } from "./admin-form";

describe("stripClientScope", () => {
  it("descarta plataforma e institución que mande el cliente", () => {
    expect(
      stripClientScope({ title: "Hola", platform: "clickaton", workspaceKey: "otra", workspaceId: "otra" }),
    ).toEqual({ title: "Hola" });
  });
  it("un cuerpo que no es objeto queda vacío", () => {
    expect(stripClientScope(null)).toEqual({});
    expect(stripClientScope("x")).toEqual({});
    expect(stripClientScope([1, 2])).toEqual({});
  });
});

describe("parseListLimit", () => {
  it("usa el valor por defecto si no viene o no es número", () => {
    expect(parseListLimit(null)).toBe(50);
    expect(parseListLimit("")).toBe(50);
    expect(parseListLimit("abc", 20)).toBe(20);
  });
  it("acota entre 1 y el máximo", () => {
    expect(parseListLimit("0")).toBe(1);
    expect(parseListLimit("9999")).toBe(200);
    expect(parseListLimit("12.7")).toBe(12);
  });
});

describe("textos opcionales", () => {
  it("vacío es null y se corta en el máximo", () => {
    expect(trimOptionalFormValue("   ", 10)).toBeNull();
    expect(trimOptionalFormValue("  abcdef  ", 3)).toBe("abc");
    expect(trimOptionalFormValue(null, 3)).toBeNull();
  });
  it("readOptionalText distingue no tocar, borrar y error", () => {
    expect(readOptionalText({}, "title", 10)).toEqual({ ok: true, value: undefined });
    expect(readOptionalText({ title: null }, "title", 10)).toEqual({ ok: true, value: null });
    expect(readOptionalText({ title: " " }, "title", 10)).toEqual({ ok: true, value: null });
    expect(readOptionalText({ title: 3 }, "title", 10)).toEqual({ ok: false, field: "title" });
  });
});

describe("parseUploadKind", () => {
  it("sólo 'hero' es portada", () => {
    expect(parseUploadKind("hero")).toBe("hero");
    expect(parseUploadKind("media")).toBe("media");
    expect(parseUploadKind(null)).toBe("media");
    expect(parseUploadKind("otra")).toBe("media");
  });
});

describe("errores del motor", () => {
  it("traduce relaciones inválidas", () => {
    expect(mensajeDeRelacion(new ContentError("CONTENT_AUTHOR_NOT_FOUND"))).toMatch(/autor/);
    expect(mensajeDeRelacion(new ContentError("CONTENT_SLUG_CONFLICT"))).toBeNull();
    expect(mensajeDeRelacion(new Error("x"))).toBeNull();
  });
  it("asigna el estado HTTP", () => {
    expect(contentErrorStatus(new ContentError("CONTENT_NOT_FOUND"))).toBe(404);
    expect(contentErrorStatus(new ContentError("CONTENT_SLUG_CONFLICT"))).toBe(409);
    expect(contentErrorStatus(new ContentError("CONTENT_TAG_NOT_FOUND"))).toBe(400);
    // La institución la pone el servidor: si falta, el error es nuestro.
    expect(contentErrorStatus(new ContentError("CONTENT_WORKSPACE_REQUIRED"))).toBe(500);
  });
});

describe("navegación del blog", () => {
  it("reconoce la sección por la dirección", () => {
    expect(blogAdminSectionFor("/website/blog")).toBe("posts");
    expect(blogAdminSectionFor("/website/blog/nuevo")).toBe("posts");
    expect(blogAdminSectionFor("/website/blog/42")).toBe("posts");
    expect(blogAdminSectionFor("/website/blog/categorias")).toBe("categorias");
    expect(blogAdminSectionFor("/website/blog/media")).toBe("media");
    expect(blogAdminSectionFor("/website/blog/estadisticas")).toBe("estadisticas");
    expect(blogAdminSectionFor("/website/blogger")).toBeNull();
    expect(blogAdminSectionFor("/website/seo")).toBeNull();
  });
  it("Sitio web no queda marcado adentro del blog", () => {
    expect(isWebsiteNavActive("/website")).toBe(true);
    expect(isWebsiteNavActive("/website/seo")).toBe(true);
    expect(isWebsiteNavActive("/website/blog")).toBe(false);
    expect(isWebsiteNavActive("/website/blog/tags")).toBe(false);
    expect(isBlogNavActive("/website/blog/tags")).toBe(true);
    expect(isBlogNavActive("/website")).toBe(false);
  });
  it("Sitio web no queda marcado en Dominio, que tiene su ítem", () => {
    expect(isWebsiteNavActive("/website/dominio")).toBe(false);
    expect(isDomainNavActive("/website/dominio")).toBe(true);
    expect(isDomainNavActive("/website/dominios-raros")).toBe(false);
    expect(isDomainNavActive("/website")).toBe(false);
  });
});

describe("toDateInputValueAr", () => {
  it("usa el día de Buenos Aires, no el de UTC", () => {
    // 01:30 UTC del 3/10 son las 22:30 del 2/10 en Argentina.
    expect(toDateInputValueAr("2026-10-03T01:30:00Z")).toBe("2026-10-02");
    expect(toDateInputValueAr(null)).toBe("");
    expect(toDateInputValueAr("no-es-fecha")).toBe("");
  });
});
