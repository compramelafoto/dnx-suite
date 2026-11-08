import { describe, expect, it } from "vitest";
import { creditoDeFoto, imagenDeHtml, metasDeHtml, nombreDeArchivo, tipoDeImagenAceptado } from "./imagen";

const pagina = (cabeza: string) => `<!doctype html><html><head>${cabeza}</head><body><p>Nota</p></body></html>`;

describe("imagenDeHtml", () => {
  it("toma og:image (absoluta o relativa) y el nombre del sitio", () => {
    const html = pagina(`<meta property="og:site_name" content="Infobae"><meta content="https://cdn.infobae.com/foto.jpg?w=1200&amp;h=630" property="og:image" />`);
    expect(imagenDeHtml(html, "https://www.infobae.com/cultura/2026/11/07/nota/")).toEqual({
      url: "https://cdn.infobae.com/foto.jpg?w=1200&h=630",
      credito: null,
      sitio: "Infobae",
    });
    expect(imagenDeHtml(pagina(`<meta property='og:image' content='/img/portada.webp'>`), "https://medio.com.ar/notas/1")?.url).toBe("https://medio.com.ar/img/portada.webp");
  });

  it("prefiere og:image:secure_url; si no hay og, usa twitter:image", () => {
    const ambas = pagina(`<meta property="og:image" content="http://a.com/x.jpg"><meta property="og:image:secure_url" content="https://a.com/x.jpg">`);
    expect(imagenDeHtml(ambas, "https://a.com/n")?.url).toBe("https://a.com/x.jpg");
    expect(imagenDeHtml(pagina(`<meta name="twitter:image" content="https://a.com/t.png">`), "https://a.com/n")?.url).toBe("https://a.com/t.png");
  });

  it("usa el crédito de la foto si lo declara (no el autor de la nota)", () => {
    const html = pagina(`<meta property="og:image" content="https://a.com/x.jpg"><meta name="author" content="Redactora"><meta property="og:image:credit" content="Foto: AFP / Juan Pérez">`);
    expect(imagenDeHtml(html, "https://a.com/n")?.credito).toBe("Foto: AFP / Juan Pérez");
    expect(imagenDeHtml(pagina(`<meta property="og:image" content="https://a.com/x.jpg"><meta name="author" content="Redactora">`), "https://a.com/n")?.credito).toBeNull();
  });

  it("descarta SVG, GIF, direcciones internas y páginas sin imagen", () => {
    expect(imagenDeHtml(pagina(`<meta property="og:image" content="https://a.com/logo.svg">`), "https://a.com/n")).toBeNull();
    expect(imagenDeHtml(pagina(`<meta property="og:image" content="https://a.com/anim.gif?x=1">`), "https://a.com/n")).toBeNull();
    expect(imagenDeHtml(pagina(`<meta property="og:image" content="http://192.168.0.1/x.jpg">`), "https://a.com/n")).toBeNull();
    expect(imagenDeHtml(pagina(`<meta property="og:image" content="http://localhost/x.jpg">`), "https://a.com/n")).toBeNull();
    expect(imagenDeHtml(pagina(`<meta property="og:title" content="Hola">`), "https://a.com/n")).toBeNull();
    // Si la primera no sirve, prueba la siguiente.
    expect(imagenDeHtml(pagina(`<meta property="og:image" content="https://a.com/logo.svg"><meta name="twitter:image" content="https://a.com/t.jpg">`), "https://a.com/n")?.url).toBe("https://a.com/t.jpg");
  });

  it("no confunde data-name ni data-content con los atributos de verdad", () => {
    expect(metasDeHtml(`<meta data-name="og:image" name="description" data-content="x" content="Real">`)).toEqual([{ clave: "description", valor: "Real" }]);
  });
});

describe("tipoDeImagenAceptado", () => {
  it("sólo JPEG, PNG y WebP", () => {
    expect(tipoDeImagenAceptado("image/jpeg")).toBe("image/jpeg");
    expect(tipoDeImagenAceptado("Image/PNG; charset=binary")).toBe("image/png");
    expect(tipoDeImagenAceptado("image/webp")).toBe("image/webp");
    expect(tipoDeImagenAceptado("image/gif")).toBeNull();
    expect(tipoDeImagenAceptado("text/html")).toBeNull();
    expect(tipoDeImagenAceptado(null)).toBeNull();
  });
});

describe("nombreDeArchivo", () => {
  it("periodista-<dominio>.<extensión>", () => {
    expect(nombreDeArchivo("https://www.petapixel.com/x/y.jpeg?w=1", "image/jpeg")).toBe("periodista-petapixel.com.jpg");
    expect(nombreDeArchivo("no es url", "image/webp")).toBe("periodista-fuente.webp");
  });
});

describe("creditoDeFoto", () => {
  it("medio, o el nombre del sitio, o el dominio; con el crédito de la foto delante", () => {
    expect(creditoDeFoto({ medio: "PetaPixel", fuenteUrl: "https://www.petapixel.com/a" })).toEqual({ texto: "PetaPixel", url: "https://www.petapixel.com/a", enlace: "petapixel.com" });
    expect(creditoDeFoto({ medio: null, sitio: "Infobae", fuenteUrl: "https://infobae.com/a" }).texto).toBe("Infobae");
    expect(creditoDeFoto({ fuenteUrl: "https://www.lanacion.com.ar/a" }).texto).toBe("lanacion.com.ar");
    expect(creditoDeFoto({ medio: "Télam", credito: "Juan Pérez", fuenteUrl: "https://telam.com.ar/a" }).texto).toBe("Juan Pérez / Télam");
    expect(creditoDeFoto({ medio: "AFP", credito: "afp", fuenteUrl: "https://afp.com/a" }).texto).toBe("AFP");
  });
});
