import { describe, expect, it } from "vitest";
import { holdForLinkedPost, linkedBlogPostSlug, linkedPostIssue, linkedPostWarning } from "./linked-post";

const sfpr = { appBase: "https://fotoffice.com", publicSlug: "sfpr", domain: "sfpr.com.ar" };
// 22/10/2026 10:00 en Argentina = 13:00 UTC.
const publicacion = new Date("2026-10-22T13:00:00Z");
const programado = { title: "La SFPR presenta su proyecto", status: "PUBLISHED", publishedAt: publicacion };

describe("linkedBlogPostSlug", () => {
  it("reconoce el dominio propio, con o sin www, y sin importar barra final, consulta o ancla", () => {
    expect(linkedBlogPostSlug("https://sfpr.com.ar/blog/presenta-proyecto", sfpr)).toBe("presenta-proyecto");
    expect(linkedBlogPostSlug("https://www.sfpr.com.ar/blog/presenta-proyecto/", sfpr)).toBe("presenta-proyecto");
    expect(linkedBlogPostSlug("https://SFPR.com.ar/blog/presenta-proyecto?utm_source=correo#arriba", sfpr)).toBe("presenta-proyecto");
    expect(linkedBlogPostSlug("  http://sfpr.com.ar/blog/presenta-proyecto  ", sfpr)).toBe("presenta-proyecto");
  });

  it("reconoce el sitio dentro de FOTOFFICE: /w/<slug>/blog/<artículo>", () => {
    expect(linkedBlogPostSlug("https://fotoffice.com/w/sfpr/blog/presenta-proyecto", sfpr)).toBe("presenta-proyecto");
    expect(linkedBlogPostSlug("https://www.fotoffice.com/w/SFPR/blog/presenta-proyecto", sfpr)).toBe("presenta-proyecto");
    expect(linkedBlogPostSlug("https://fotoffice.com/w/sfpr/blog/a%C3%B1o-nuevo", sfpr)).toBe("año-nuevo");
  });

  it("no confunde otras direcciones con un artículo propio", () => {
    expect(linkedBlogPostSlug(null, sfpr)).toBeNull();
    expect(linkedBlogPostSlug("", sfpr)).toBeNull();
    expect(linkedBlogPostSlug("no es una dirección", sfpr)).toBeNull();
    expect(linkedBlogPostSlug("https://sfpr.com.ar/blog", sfpr)).toBeNull();
    expect(linkedBlogPostSlug("https://sfpr.com.ar/blog/categoria/eventos", sfpr)).toBeNull();
    expect(linkedBlogPostSlug("https://sfpr.com.ar/cursos/iluminacion", sfpr)).toBeNull();
    expect(linkedBlogPostSlug("https://otra.com.ar/blog/presenta-proyecto", sfpr)).toBeNull();
    expect(linkedBlogPostSlug("https://fotoffice.com/w/otra/blog/presenta-proyecto", sfpr)).toBeNull();
    expect(linkedBlogPostSlug("https://fotoffice.com/blog/presenta-proyecto", sfpr)).toBeNull();
    expect(linkedBlogPostSlug("mailto:hola@sfpr.com.ar", sfpr)).toBeNull();
    expect(linkedBlogPostSlug("https://sfpr.com.ar/blog/%E0%A4%A", sfpr)).toBeNull();
  });

  it("sin dominio propio ni slug público no reconoce nada de eso", () => {
    const sinNada = { appBase: null, publicSlug: null, domain: null };
    expect(linkedBlogPostSlug("https://sfpr.com.ar/blog/x", sinNada)).toBeNull();
    expect(linkedBlogPostSlug("https://fotoffice.com/w/sfpr/blog/x", sinNada)).toBeNull();
  });
});

describe("linkedPostIssue", () => {
  it("se ve sólo publicado y con la fecha cumplida", () => {
    expect(linkedPostIssue(programado, new Date("2026-10-22T13:00:00Z"))).toBeNull();
    expect(linkedPostIssue(programado, new Date("2026-10-20T05:08:00Z"))).toBe("NOT_YET");
    expect(linkedPostIssue({ ...programado, status: "DRAFT" }, publicacion)).toBe("DRAFT");
    expect(linkedPostIssue({ ...programado, publishedAt: null }, publicacion)).toBe("DRAFT");
    expect(linkedPostIssue({ ...programado, status: "ARCHIVED" }, publicacion)).toBe("ARCHIVED");
    expect(linkedPostIssue(null, publicacion)).toBe("MISSING");
  });
});

describe("regla de la tarea programada", () => {
  it("caso SFPR: retiene la campaña hasta que el artículo se publica, después la deja salir", () => {
    expect(holdForLinkedPost("presenta-proyecto", programado, new Date("2026-10-22T12:50:00Z"))).toBe("NOT_YET");
    expect(holdForLinkedPost("presenta-proyecto", programado, new Date("2026-10-22T13:10:00Z"))).toBeNull();
  });

  it("retiene si está en borrador o no existe; no retiene si el botón no lleva al blog", () => {
    const ahora = new Date("2026-10-22T13:10:00Z");
    expect(holdForLinkedPost("x", { ...programado, status: "DRAFT" }, ahora)).toBe("DRAFT");
    expect(holdForLinkedPost("x", null, ahora)).toBe("MISSING");
    expect(holdForLinkedPost(null, null, ahora)).toBeNull();
  });
});

describe("linkedPostWarning", () => {
  const ahora = new Date("2026-10-20T05:08:00Z"); // 20/10 02:08 en Argentina

  it("programada antes de la publicación: avisa con las dos fechas en hora argentina", () => {
    const aviso = linkedPostWarning({ slug: "p", post: programado, sendAt: new Date("2026-10-21T13:00:00Z"), now: ahora });
    expect(aviso).toContain("«La SFPR presenta su proyecto»");
    expect(aviso).toContain("22 oct 2026");
    expect(aviso).toContain("10:00");
    expect(aviso).toContain("21 oct 2026");
    expect(aviso).toContain("espera");
  });

  it("programada después de la publicación: sin aviso", () => {
    expect(linkedPostWarning({ slug: "p", post: programado, sendAt: new Date("2026-10-22T13:00:00Z"), now: ahora })).toBeNull();
  });

  it("la prueba sale en el momento: avisa aunque la campaña esté bien programada", () => {
    const aviso = linkedPostWarning({ slug: "p", post: programado, sendAt: new Date("2026-10-22T14:00:00Z"), now: ahora, test: true });
    expect(aviso).toContain("En la prueba");
    expect(linkedPostWarning({ slug: "p", post: programado, sendAt: null, now: new Date("2026-10-23T00:00:00Z"), test: true })).toBeNull();
  });

  it("borrador, archivado, inexistente y envío inmediato", () => {
    expect(linkedPostWarning({ slug: "p", post: { ...programado, status: "DRAFT" }, sendAt: null, now: ahora })).toContain("en borrador");
    expect(linkedPostWarning({ slug: "p", post: { ...programado, status: "ARCHIVED" }, sendAt: null, now: ahora })).toContain("archivado");
    expect(linkedPostWarning({ slug: "mal-escrito", post: null, sendAt: null, now: ahora })).toContain("«mal-escrito»");
    expect(linkedPostWarning({ slug: "p", post: programado, sendAt: null, now: ahora })).toContain("no se puede enviar en el momento");
    expect(linkedPostWarning({ slug: null, post: null, sendAt: null, now: ahora })).toBeNull();
  });
});
