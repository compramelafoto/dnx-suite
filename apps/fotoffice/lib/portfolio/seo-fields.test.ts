import { describe, expect, it } from "vitest";
import {
  SEO_DESCRIPCION_MAX,
  SEO_TITULO_MAX,
  descripcionEfectiva,
  esOpcionMiniatura,
  limpiarTextoSeo,
  miniaturaEfectiva,
  recorteDeGoogle,
  tituloEfectivo,
} from "./seo-fields";

describe("limpiarTextoSeo", () => {
  it("aplasta espacios y saltos: en Google todo va en una línea", () => {
    expect(limpiarTextoSeo("  Fotógrafo   de\n\n15  ", 100)).toBe("Fotógrafo de 15");
  });

  it("vacío es null, no cadena vacía", () => {
    expect(limpiarTextoSeo("   ", 100)).toBeNull();
    expect(limpiarTextoSeo(null, 100)).toBeNull();
    expect(limpiarTextoSeo(undefined, 100)).toBeNull();
  });

  it("corta al tope en vez de rechazar", () => {
    expect(limpiarTextoSeo("a".repeat(500), 120)).toHaveLength(120);
  });
});

describe("recorteDeGoogle", () => {
  it("lo que entra, entra entero", () => {
    expect(recorteDeGoogle("Fotógrafo en Funes", 60)).toEqual({
      visible: "Fotógrafo en Funes",
      cortado: false,
    });
  });

  it("corta en la última palabra entera, no al medio de una", () => {
    const r = recorteDeGoogle("Fotógrafo de quince años y casamientos en Funes, Santa Fe", 30);
    expect(r.cortado).toBe(true);
    expect(r.visible).toBe("Fotógrafo de quince años y");
    expect(r.visible.endsWith(" ")).toBe(false);
  });

  it("si la primera palabra ya no entra, corta duro: mejor algo que nada", () => {
    const r = recorteDeGoogle("Supercalifragilisticoespialidoso", 10);
    expect(r.visible).toHaveLength(10);
    expect(r.cortado).toBe(true);
  });

  it("justo en el límite no se corta", () => {
    expect(recorteDeGoogle("12345", 5).cortado).toBe(false);
  });
});

describe("tituloEfectivo", () => {
  const base = { displayName: "Daniel Cuart", businessName: "DNX Estudio", city: "Funes" };

  it("manda el que escribió el socio", () => {
    expect(tituloEfectivo({ ...base, seoTitle: "Fotógrafo de 15 en Funes | DNX Estudio" })).toBe(
      "Fotógrafo de 15 en Funes | DNX Estudio",
    );
  });

  it("sin nada escrito, lo arma con lo que hay", () => {
    expect(tituloEfectivo({ ...base, seoTitle: null })).toBe("Daniel Cuart · DNX Estudio · Funes");
  });

  it("sin estudio ni ciudad queda sólo el nombre", () => {
    expect(
      tituloEfectivo({ seoTitle: null, displayName: "Ana Ruiz", businessName: null, city: null }),
    ).toBe("Ana Ruiz");
  });

  it("un título con sólo espacios cuenta como vacío", () => {
    expect(tituloEfectivo({ ...base, seoTitle: "   " })).toBe("Daniel Cuart · DNX Estudio · Funes");
  });

  it("nunca pasa el tope duro", () => {
    expect(tituloEfectivo({ ...base, seoTitle: "x".repeat(400) })).toHaveLength(SEO_TITULO_MAX);
  });
});

describe("descripcionEfectiva", () => {
  const base = {
    displayName: "Daniel Cuart",
    businessName: "DNX Estudio",
    rubros: ["Casamientos", "Quince años (XV)"],
    city: "Funes",
    province: "Santa Fe",
    institucion: "SFPR",
  };

  it("primero la escrita para Google", () => {
    expect(
      descripcionEfectiva({ ...base, seoDescription: "Fotografío 15 y bodas en Funes.", bio: "Otra cosa." }),
    ).toBe("Fotografío 15 y bodas en Funes.");
  });

  it("después la presentación", () => {
    expect(descripcionEfectiva({ ...base, seoDescription: null, bio: "Soy fotógrafo y docente." })).toBe(
      "Soy fotógrafo y docente.",
    );
  });

  it("la presentación va en una sola línea: Google no muestra párrafos", () => {
    expect(descripcionEfectiva({ ...base, seoDescription: null, bio: "Uno.\n\nDos." })).toBe("Uno. Dos.");
  });

  it("sin nada escrito la arma, porque vacía la decide Google y elige mal", () => {
    expect(descripcionEfectiva({ ...base, seoDescription: null, bio: null })).toBe(
      "DNX Estudio · Casamientos, Quince años (XV) · en Funes, Santa Fe · Socio de SFPR.",
    );
  });

  it("sin estudio usa el nombre de la persona", () => {
    expect(
      descripcionEfectiva({ ...base, businessName: null, seoDescription: null, bio: null }),
    ).toContain("Daniel Cuart");
  });

  it("nunca pasa el tope duro, venga de donde venga", () => {
    expect(
      descripcionEfectiva({ ...base, seoDescription: null, bio: "z".repeat(900) }),
    ).toHaveLength(SEO_DESCRIPCION_MAX);
  });
});

describe("esOpcionMiniatura", () => {
  it("acepta las tres y nada más", () => {
    expect(esOpcionMiniatura("LOGO")).toBe(true);
    expect(esOpcionMiniatura("COVER")).toBe(true);
    expect(esOpcionMiniatura("PROFILE")).toBe(true);
    expect(esOpcionMiniatura("logo")).toBe(false);
    expect(esOpcionMiniatura(null)).toBe(false);
    expect(esOpcionMiniatura(7)).toBe(false);
  });
});

describe("miniaturaEfectiva", () => {
  const todas = { logoUrl: "/logo.png", coverUrl: "/portada.jpg", profilePhotoUrl: "/yo.jpg" };

  it("manda lo que eligió el socio", () => {
    expect(miniaturaEfectiva({ ...todas, seoImageChoice: "COVER" })).toBe("/portada.jpg");
    expect(miniaturaEfectiva({ ...todas, seoImageChoice: "PROFILE" })).toBe("/yo.jpg");
  });

  it("sin elegir nada, el orden de siempre: logo, portada, perfil", () => {
    expect(miniaturaEfectiva({ ...todas, seoImageChoice: null })).toBe("/logo.png");
    expect(miniaturaEfectiva({ ...todas, logoUrl: null, seoImageChoice: null })).toBe("/portada.jpg");
  });

  it("eligió el logo y después lo borró: cae al orden automático, no se queda sin imagen", () => {
    expect(miniaturaEfectiva({ ...todas, logoUrl: null, seoImageChoice: "LOGO" })).toBe("/portada.jpg");
  });

  it("sin ninguna imagen, null", () => {
    expect(
      miniaturaEfectiva({ logoUrl: null, coverUrl: null, profilePhotoUrl: null, seoImageChoice: "LOGO" }),
    ).toBeNull();
  });

  it("una elección inventada se ignora", () => {
    expect(miniaturaEfectiva({ ...todas, seoImageChoice: "CUALQUIERA" })).toBe("/logo.png");
  });
});
