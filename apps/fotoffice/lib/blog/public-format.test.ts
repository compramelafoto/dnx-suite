import { describe, expect, it } from "vitest";
import {
  absoluteUrl,
  buildBlogRssXml,
  buildCategoryChips,
  escapeXml,
  formatBlogDate,
  readingMinutes,
  resolveBlogVisitorKey,
  splitFeatured,
  toBlogCard,
} from "./public-format";

describe("formatBlogDate", () => {
  it("escribe la fecha larga en castellano", () => {
    expect(formatBlogDate(new Date("2025-12-28T15:00:00Z"))).toBe("28 de diciembre de 2025");
  });

  it("usa la hora argentina: las 22 h del 28 siguen siendo el 28, aunque en UTC ya sea el 29", () => {
    expect(formatBlogDate(new Date("2025-12-29T01:30:00Z"))).toBe("28 de diciembre de 2025");
  });

  it("sin fecha, o con una fecha inválida, no inventa nada", () => {
    expect(formatBlogDate(null)).toBeNull();
    expect(formatBlogDate("no es una fecha")).toBeNull();
  });
});

describe("absoluteUrl", () => {
  it("deja intacta una dirección que ya es absoluta (las portadas de R2)", () => {
    expect(absoluteUrl("https://app.fotoffice.com", "https://cdn.x/a.jpg")).toBe("https://cdn.x/a.jpg");
  });

  it("completa una relativa con la dirección de la app, sin barras dobles", () => {
    expect(absoluteUrl("https://app.fotoffice.com/", "/w/sfpr/blog")).toBe("https://app.fotoffice.com/w/sfpr/blog");
  });

  it("vacío es null", () => {
    expect(absoluteUrl("https://x", "  ")).toBeNull();
    expect(absoluteUrl("https://x", null)).toBeNull();
  });
});

describe("toBlogCard", () => {
  it("arma la tarjeta con la fecha ya formateada y sin espacios sueltos", () => {
    const card = toBlogCard(
      {
        id: 7,
        slug: "hola",
        title: "Hola",
        excerpt: "  ",
        heroImageUrl: null,
        publishedAt: new Date("2025-12-28T15:00:00Z"),
        category: { name: "Noticias" },
      },
      "/w/sfpr/blog/hola",
    );
    expect(card).toMatchObject({ id: 7, href: "/w/sfpr/blog/hola", excerpt: null, categoryName: "Noticias", dateLabel: "28 de diciembre de 2025" });
  });
});

describe("escapeXml y buildBlogRssXml", () => {
  it("escapa los cinco caracteres peligrosos", () => {
    expect(escapeXml(`<a href="x">Tom & Jerry's</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&apos;s&lt;/a&gt;");
  });

  it("un título con & no rompe el RSS", () => {
    const xml = buildBlogRssXml({
      title: "Blog de Foto & Cine",
      description: "Notas",
      siteUrl: "https://x/w/a/blog",
      feedUrl: "https://x/w/a/blog/rss.xml",
      items: [{ title: "Luz & sombra", url: "https://x/w/a/blog/luz", description: "Un ]]> raro", publishedAt: new Date("2025-01-02T12:00:00Z"), category: null }],
    });
    expect(xml).toContain("<title>Blog de Foto &amp; Cine</title>");
    expect(xml).toContain("<title>Luz &amp; sombra</title>");
    expect(xml).toContain("<description>Un ]]&gt; raro</description>");
    expect(xml).toContain("<pubDate>Thu, 02 Jan 2025 12:00:00 GMT</pubDate>");
    expect(xml).not.toContain("<category>");
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
  });

  it("sin artículos sigue siendo un canal válido", () => {
    const xml = buildBlogRssXml({ title: "B", description: "D", siteUrl: "https://x", feedUrl: "https://x/rss.xml", items: [] });
    expect(xml).toContain("<channel>");
    expect(xml).not.toContain("<item>");
  });
});

describe("resolveBlogVisitorKey", () => {
  it("reutiliza la cookie existente", () => {
    expect(resolveBlogVisitorKey("abcdefgh-1234")).toEqual({ visitorKey: "abcdefgh-1234", isNew: false });
  });

  it("sin cookie, o con una demasiado corta, crea una nueva", () => {
    expect(resolveBlogVisitorKey(undefined).isNew).toBe(true);
    expect(resolveBlogVisitorKey("abc").isNew).toBe(true);
  });
});

describe("buildCategoryChips", () => {
  const cats = [
    { slug: "noticias", name: "Noticias", _count: { posts: 3 } },
    { slug: "vacia", name: "Vacía", _count: { posts: 0 } },
  ];

  it("'Todos' primero y sin las categorías vacías", () => {
    const chips = buildCategoryChips("/w/a/blog", cats, null);
    expect(chips.map((c) => c.label)).toEqual(["Todos", "Noticias"]);
    expect(chips[0].active).toBe(true);
    expect(chips[1].href).toBe("/w/a/blog/categoria/noticias");
  });

  it("marca la categoría actual", () => {
    const chips = buildCategoryChips("/w/a/blog", cats, "noticias");
    expect(chips.map((c) => c.active)).toEqual([false, true]);
  });
});

describe("splitFeatured", () => {
  it("el destacado va arriba y el resto conserva su orden", () => {
    const { featured, rest } = splitFeatured([
      { id: 1, isFeatured: false },
      { id: 2, isFeatured: true },
      { id: 3, isFeatured: false },
    ]);
    expect(featured?.id).toBe(2);
    expect(rest.map((p) => p.id)).toEqual([1, 3]);
  });

  it("sin destacado, va el primero", () => {
    const { featured, rest } = splitFeatured([
      { id: 1, isFeatured: false },
      { id: 2, isFeatured: false },
    ]);
    expect(featured?.id).toBe(1);
    expect(rest.map((p) => p.id)).toEqual([2]);
  });

  it("sin artículos no hay nada", () => {
    expect(splitFeatured([])).toEqual({ featured: null, rest: [] });
  });
});

describe("readingMinutes", () => {
  it("usa el dato del motor cuando lo hay", () => {
    expect(readingMinutes(6, "<p>hola</p>")).toBe(6);
  });

  it("si falta, lo estima por palabras y nunca da cero", () => {
    expect(readingMinutes(null, "<p>hola</p>")).toBe(1);
    expect(readingMinutes(0, `<p>${"palabra ".repeat(600)}</p>`)).toBe(3);
  });
});
