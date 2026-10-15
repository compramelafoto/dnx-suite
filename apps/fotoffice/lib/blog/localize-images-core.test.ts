import { describe, expect, it } from "vitest";
import { collectImageSources, isExternalBlogImage, replaceImageSources } from "./localize-images-core";

const ALBOOM = "https://cdn.alboompro.com/x/original_size/foto.jpg?v=1";

describe("isExternalBlogImage", () => {
  it("sólo las de sitios conocidos y por https", () => {
    expect(isExternalBlogImage(ALBOOM)).toBe(true);
    expect(isExternalBlogImage("https://fotorank.dnxsuite.com/contest-assets/a.jpg")).toBe(true);
    expect(isExternalBlogImage("https://pub-123.r2.dev/fotoffice/blog-media/a.jpg")).toBe(false);
    expect(isExternalBlogImage("https://evil.example.com/a.jpg")).toBe(false);
    expect(isExternalBlogImage("http://cdn.alboompro.com/a.jpg")).toBe(false);
    expect(isExternalBlogImage("no es una url")).toBe(false);
    expect(isExternalBlogImage(null)).toBe(false);
  });
});

describe("reemplazo de imágenes en el documento", () => {
  const doc = {
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "hola" }] },
      { type: "image", attrs: { src: ALBOOM, alt: "a" } },
      { type: "bulletList", content: [{ type: "listItem", content: [{ type: "image", attrs: { src: "https://otra.com/b.png" } }] }] },
    ],
  };

  it("encuentra todas las imágenes, también las anidadas", () => {
    expect(collectImageSources(doc)).toEqual([ALBOOM, "https://otra.com/b.png"]);
  });

  it("reemplaza sólo las del mapa y conserva el resto de los atributos", () => {
    const nuevo = replaceImageSources(doc, new Map([[ALBOOM, "https://pub.r2.dev/n.jpg"]]));
    expect(collectImageSources(nuevo)).toEqual(["https://pub.r2.dev/n.jpg", "https://otra.com/b.png"]);
    expect(nuevo.content?.[1]?.attrs?.alt).toBe("a");
    expect(collectImageSources(doc)[0]).toBe(ALBOOM);
  });
});
