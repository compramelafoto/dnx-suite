import { describe, expect, it } from "vitest";
import { enlacesDeRedes, limpiarUsuario, normalizarUrl, urlsDeRedes } from "./social-links";

const vacias = {
  website: null,
  instagram: null,
  tiktok: null,
  facebook: null,
  youtube: null,
  linkedin: null,
};

describe("normalizarUrl", () => {
  it("le pone https a quien escribió sólo el dominio", () => {
    expect(normalizarUrl("miestudio.com.ar")).toBe("https://miestudio.com.ar");
  });

  it("deja en paz la que ya lo tiene", () => {
    expect(normalizarUrl("https://miestudio.com.ar/")).toBe("https://miestudio.com.ar/");
    expect(normalizarUrl("http://viejo.com")).toBe("http://viejo.com");
  });
});

describe("limpiarUsuario", () => {
  it("saca el arroba", () => {
    expect(limpiarUsuario("@juanfoto")).toBe("juanfoto");
  });

  it("saca la dirección completa si la pegaron entera", () => {
    expect(limpiarUsuario("https://www.instagram.com/juanfoto/")).toBe("juanfoto");
    expect(limpiarUsuario("instagram.com/juanfoto")).toBe("instagram.com/juanfoto");
  });

  it("un usuario limpio queda igual", () => {
    expect(limpiarUsuario("  juanfoto  ")).toBe("juanfoto");
  });
});

describe("enlacesDeRedes", () => {
  it("arma direcciones absolutas para todas", () => {
    expect(
      enlacesDeRedes({
        website: "miestudio.com.ar",
        instagram: "juanfoto",
        tiktok: "@juanfoto",
        facebook: "facebook.com/juanfoto",
        youtube: "https://youtube.com/@juanfoto",
        linkedin: "linkedin.com/in/juan",
      }),
    ).toEqual([
      { etiqueta: "Sitio", href: "https://miestudio.com.ar" },
      { etiqueta: "Instagram", href: "https://instagram.com/juanfoto" },
      { etiqueta: "TikTok", href: "https://tiktok.com/@juanfoto" },
      { etiqueta: "Facebook", href: "https://facebook.com/juanfoto" },
      { etiqueta: "YouTube", href: "https://youtube.com/@juanfoto" },
      { etiqueta: "LinkedIn", href: "https://linkedin.com/in/juan" },
    ]);
  });

  it("sin redes, lista vacía", () => {
    expect(enlacesDeRedes(vacias)).toEqual([]);
  });

  it("un campo que queda vacío al limpiarlo no genera enlace", () => {
    // Un arroba suelto llevaría a la portada de Instagram, que no es el perfil de nadie.
    expect(enlacesDeRedes({ ...vacias, instagram: "@" })).toEqual([]);
    expect(enlacesDeRedes({ ...vacias, website: "   " })).toEqual([]);
  });
});

describe("urlsDeRedes", () => {
  it("es lo que va al sameAs: sólo direcciones absolutas", () => {
    const urls = urlsDeRedes({ ...vacias, instagram: "juanfoto", website: "miestudio.com.ar" });
    expect(urls).toEqual(["https://miestudio.com.ar", "https://instagram.com/juanfoto"]);
    // El error que esto evita: un usuario suelto en sameAs, que Google descarta.
    for (const u of urls) expect(u).toMatch(/^https?:\/\//);
  });
});
