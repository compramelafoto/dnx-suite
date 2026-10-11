import { describe, expect, it } from "vitest";
import { armarBloques, csvDeSeleccion, exportarSeleccion, nombresParaExportar, nombreSinExtension } from "./exportar";

const f = (...ns: string[]) => ns.map((fileName) => ({ fileName }));

describe("nombre sin extensión", () => {
  it("saca sólo la última extensión", () => {
    expect(nombreSinExtension("IMG_0012.jpg")).toBe("IMG_0012");
    expect(nombreSinExtension("IMG_0012.CR2")).toBe("IMG_0012");
    expect(nombreSinExtension("boda.final.jpeg")).toBe("boda.final");
    expect(nombreSinExtension("DSC_1.Nef")).toBe("DSC_1");
    expect(nombreSinExtension("A.heic")).toBe("A");
    expect(nombreSinExtension("A.tiff")).toBe("A");
    expect(nombreSinExtension("sin-extension")).toBe("sin-extension");
    expect(nombreSinExtension(".oculto")).toBe(".oculto");
    expect(nombreSinExtension(".jpg")).toBe(".jpg");
    expect(nombreSinExtension("  IMG_1.png ")).toBe("IMG_1");
  });
});

describe("nombre con punto que no es extensión", () => {
  it("no corta lo que no es una extensión de imagen o RAW conocida", () => {
    expect(nombreSinExtension("Boda v1.2")).toBe("Boda v1.2");
    expect(nombreSinExtension("Boda v1.2.jpg")).toBe("Boda v1.2");
    expect(nombreSinExtension("IMG 3.final")).toBe("IMG 3.final");
    expect(nombreSinExtension("foto.webp")).toBe("foto.webp");
  });
});

describe("bloques", () => {
  it("un bloque si entra en 1000 caracteres, con el separador", () => {
    expect(armarBloques(["a", "b", "c"], ", ")).toEqual(["a, b, c"]);
    expect(armarBloques(["a", "b", "c"], " OR ")).toEqual(["a OR b OR c"]);
    expect(armarBloques([], ", ")).toEqual([]);
  });

  it("ningún bloque pasa de 1000 caracteres y no se pierde ni repite un nombre", () => {
    const nombres = Array.from({ length: 400 }, (_, i) => `IMG_${String(i + 1).padStart(4, "0")}`);
    for (const sep of [", ", " OR "]) {
      const bloques = armarBloques(nombres, sep);
      expect(bloques.length).toBeGreaterThan(1);
      for (const b of bloques) expect(b.length).toBeLessThanOrEqual(1000);
      expect(bloques.flatMap((b) => b.split(sep))).toEqual(nombres);
    }
  });

  it("llena el bloque hasta el límite exacto", () => {
    // 3 nombres de 4 caracteres con ", " = 4 + 2 + 4 + 2 + 4 = 16
    expect(armarBloques(["aaaa", "bbbb", "cccc"], ", ", 16)).toEqual(["aaaa, bbbb, cccc"]);
    expect(armarBloques(["aaaa", "bbbb", "cccc"], ", ", 15)).toEqual(["aaaa, bbbb", "cccc"]);
  });

  it("un nombre solo que supera el máximo va en su propio bloque", () => {
    const largo = "x".repeat(1200);
    expect(armarBloques(["a", largo, "b"], ", ")).toEqual(["a", largo, "b"]);
  });
});

describe("exportarSeleccion", () => {
  it("ordena natural, saca extensiones y no repite nombres", () => {
    const r = exportarSeleccion(f("IMG_10.jpg", "IMG_2.JPG", "img_2.png", "IMG_1.jpg"));
    expect(r.nombres).toEqual(["IMG_1", "IMG_2", "IMG_10"]);
    expect(r.total).toBe(3);
    expect(r.lightroom).toEqual(["IMG_1, IMG_2, IMG_10"]);
    expect(r.windows).toEqual(["IMG_1 OR IMG_2 OR IMG_10"]);
  });

  it("sin fotos no hay bloques", () => {
    expect(exportarSeleccion([])).toEqual({ total: 0, nombres: [], lightroom: [], windows: [] });
    expect(nombresParaExportar(f(""))).toEqual([]);
  });

  it("3000 fotos entran en bloques de hasta 1000 caracteres", () => {
    const fotos = f(...Array.from({ length: 3000 }, (_, i) => `DSC_${String(i + 1).padStart(5, "0")}.NEF`));
    const r = exportarSeleccion(fotos);
    expect(r.total).toBe(3000);
    for (const b of [...r.lightroom, ...r.windows]) expect(b.length).toBeLessThanOrEqual(1000);
    expect(r.lightroom.join(", ").split(", ")).toHaveLength(3000);
  });
});

describe("CSV", () => {
  it("lleva BOM, separa con punto y coma y trae la foto con sus comentarios", () => {
    const csv = csvDeSeleccion([
      { fileName: "IMG_10.jpg", comentarios: [] },
      { fileName: "IMG_2.jpg", comentarios: ["Más luz", "Sacar el cartel\nde atrás"] },
    ]);
    expect(csv.startsWith("﻿")).toBe(true);
    const lineas = csv.replace("﻿", "").split("\r\n");
    expect(lineas[0]).toBe("Archivo;Nombre sin extensión;Comentarios del cliente");
    expect(lineas[1]).toBe("IMG_2.jpg;IMG_2;Más luz | Sacar el cartel de atrás");
    expect(lineas[2]).toBe("IMG_10.jpg;IMG_10;");
  });

  it("no deja pasar fórmulas en los comentarios", () => {
    const csv = csvDeSeleccion([{ fileName: "a.jpg", comentarios: ["=1+1"] }]);
    expect(csv).not.toMatch(/;=1\+1/);
  });
});
