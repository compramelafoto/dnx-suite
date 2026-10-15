import { describe, expect, it } from "vitest";
import { blogDigestSubject, buildBlogDigestEmail, buildBlogPostEmail } from "./blog-email";

const brand = { name: "SFPR", logoUrl: "https://cdn.example.com/logo.png", accentColor: "#123abc" };
const footer = { reason: "Recibís este correo porque sos socio de SFPR.", unsubscribeUrl: "https://fotoffice.com/correo/baja?t=abc" };
const post = {
  title: "Santa Fe en Foco <2026>",
  excerpt: "Una muestra con 40 autores.",
  heroImageUrl: "https://cdn.example.com/hero.jpg",
  url: "https://sfpr.com.ar/blog/santa-fe-en-foco",
  categoryName: "Muestras",
};

describe("correo de un artículo", () => {
  it("lleva saludo, título escapado, botón, marca y baja", () => {
    const m = buildBlogPostEmail({ brand, post, firstName: "Ana", signature: null, footer });
    expect(m.subject).toBe("Santa Fe en Foco <2026>");
    expect(m.html).toContain("Hola Ana,");
    expect(m.html).toContain("Santa Fe en Foco &lt;2026&gt;");
    expect(m.html).not.toContain("<2026>");
    expect(m.html).toContain('href="https://sfpr.com.ar/blog/santa-fe-en-foco"');
    expect(m.html).toContain("#123abc");
    expect(m.html).toContain("https://cdn.example.com/logo.png");
    expect(m.html).toContain("correo/baja?t=abc");
    expect(m.text).toContain("Leer el artículo: https://sfpr.com.ar/blog/santa-fe-en-foco");
    expect(m.text).toContain("Darme de baja de estos correos: https://fotoffice.com/correo/baja?t=abc");
  });

  it("sin nombre, sin portada http y con color inválido no se rompe", () => {
    const m = buildBlogPostEmail({
      brand: { name: "SFPR", logoUrl: "/uploads/logo.png", accentColor: "red;}" },
      post: { ...post, heroImageUrl: "http://inseguro.com/x.jpg", excerpt: null },
      firstName: null,
      signature: { html: "<p>Firma</p>", text: "Firma" },
      footer,
    });
    expect(m.html).toContain("Hola,");
    expect(m.html).not.toContain("inseguro.com");
    expect(m.html).not.toContain("/uploads/logo.png");
    expect(m.html).not.toContain("red;}");
    expect(m.html).toContain("<p>Firma</p>");
    expect(m.text).toContain("Firma");
  });
});

describe("resumen semanal", () => {
  it("asunto según cantidad", () => {
    expect(blogDigestSubject("SFPR", [{ title: "Uno" }])).toBe("Esta semana en SFPR: Uno");
    expect(blogDigestSubject("SFPR", [{ title: "Uno" }, { title: "Dos" }])).toBe(
      "Esta semana en el blog de SFPR: 2 artículos nuevos",
    );
  });

  it("lista todos los artículos y enlaza al blog", () => {
    const m = buildBlogDigestEmail({
      brand,
      posts: [post, { ...post, title: "Otro", url: "https://sfpr.com.ar/blog/otro" }],
      firstName: "Beto",
      signature: null,
      footer,
      blogUrl: "https://sfpr.com.ar/blog",
    });
    expect(m.html).toContain("Hola Beto,");
    expect(m.html).toContain("https://sfpr.com.ar/blog/otro");
    expect(m.html).toContain("Ver todo el blog");
    expect(m.text).toContain("• Otro");
  });
});
