import { describe, expect, it } from "vitest";
import { enlacePresupuesto, numeroDePagina, serializarGaleriaJsonLd, totalDePaginas } from "./sitio-publico";

describe("numeroDePagina", () => {
  it("acepta enteros desde 1 y cae a 1 con cualquier otra cosa", () => {
    expect(numeroDePagina("3")).toBe(3);
    expect(numeroDePagina(["2", "5"])).toBe(2);
    for (const malo of [undefined, "", "0", "-1", "2.5", "abc", "99999999"]) expect(numeroDePagina(malo)).toBe(1);
  });
});

describe("totalDePaginas", () => {
  it("de a 24, y al menos una", () => {
    expect(totalDePaginas(0)).toBe(1);
    expect(totalDePaginas(24)).toBe(1);
    expect(totalDePaginas(25)).toBe(2);
  });
});

describe("enlacePresupuesto", () => {
  it("con categoría equivalente la preelige; sin ella, el formulario a secas", () => {
    expect(enlacePresupuesto("dnx-estudio", true, "k1")).toBe("/w/dnx-estudio/presupuesto?categoria=k1");
    expect(enlacePresupuesto("dnx-estudio", true, null)).toBe("/w/dnx-estudio/presupuesto");
  });

  it("con Consultas apagado no hay botón", () => {
    expect(enlacePresupuesto("dnx-estudio", false, "k1")).toBeNull();
  });
});

describe("serializarGaleriaJsonLd", () => {
  const base = {
    url: "https://app.test/w/x/trabajos/bodas/sofi",
    descripcion: "Fotos del casamiento",
    nombreSitio: "DNX Estudio",
    urlSitio: "https://app.test/w/x",
    appBase: "https://app.test",
  };

  it("arma un ImageGallery con las fotos (sin los videos) y escapa <", () => {
    const json = serializarGaleriaJsonLd({
      ...base,
      trabajo: {
        titulo: "Sofi </script>",
        categoriaNombre: "Bodas",
        lugar: "Rosario",
        portadaUrl: "/p.jpg",
        fotos: [
          { id: "f1", tipo: "FOTO", url: "https://cdn/1.jpg", ancho: 1200, alto: 800, alt: "Entrada" },
          { id: "v1", tipo: "VIDEO_URL", url: "https://youtu.be/x", ancho: null, alto: null, alt: null },
        ],
      },
    });
    expect(json).not.toContain("</script>");
    const parsed = JSON.parse(json);
    expect(parsed["@type"]).toBe("ImageGallery");
    expect(parsed.thumbnailUrl).toBe("https://app.test/p.jpg");
    expect(parsed.image).toEqual([{ "@type": "ImageObject", contentUrl: "https://cdn/1.jpg", width: 1200, height: 800, caption: "Entrada" }]);
    expect(parsed.contentLocation).toEqual({ "@type": "Place", name: "Rosario" });
  });
});
