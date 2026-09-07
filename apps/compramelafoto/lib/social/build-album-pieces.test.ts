import { describe, expect, it } from "vitest";
import { placeholdersOf, type DesignDocument, type VariableContract } from "@repo/design-studio";
import {
  buildAlbumCaption,
  buildAlbumMentions,
  buildAlbumPieceSpecs,
} from "./build-album-pieces";
import {
  ALBUM_STORY_CONTRACT,
  ALBUM_STORY_DOCUMENT,
  albumCarouselContract,
  albumCarouselDocument,
} from "./album-piece-templates";

const datos = {
  albumId: 42,
  albumName: "Maratón de Santa Fe 2026",
  eventDate: new Date("2026-08-30T00:00:00Z"),
  publicSlug: "maraton-santa-fe-2026",
  photographerHandle: "fotografo",
  organizerHandle: "maratonsantafe",
  sponsorHandles: ["sponsoruno"],
  photoUrls: [
    "https://cdn.test/1.jpg",
    "https://cdn.test/2.jpg",
    "https://cdn.test/3.jpg",
  ],
};

/** Todas las variables que un documento realmente dibuja: placeholders de texto más las
 * `variableKey` de imagen/QR. Es lo que hay que comparar contra el contrato para saber si
 * los dos están sincronizados. */
function usedVariableKeys(doc: DesignDocument): Set<string> {
  const claves = new Set<string>();
  for (const cara of doc.sides) {
    for (const bloque of cara.blocks) {
      if (bloque.type === "text") {
        for (const clave of placeholdersOf(bloque.content)) claves.add(clave);
      }
      if ((bloque.type === "image" || bloque.type === "qrcode") && "variableKey" in bloque) {
        const clave = bloque.variableKey;
        if (clave) claves.add(clave);
      }
    }
  }
  return claves;
}

describe("copy del álbum", () => {
  it("nombra el álbum, la web y el link", () => {
    const copy = buildAlbumCaption(datos);
    expect(copy).toContain("Maratón de Santa Fe 2026");
    expect(copy).toContain("compramelafoto.com/a/maraton-santa-fe-2026");
  });

  it("no incluye las menciones: de eso se ocupa el motor", () => {
    expect(buildAlbumCaption(datos)).not.toContain("@fotografo");
  });
});

describe("menciones del álbum", () => {
  it("prioriza fotógrafo, organizador, sponsor y la plataforma", () => {
    const m = buildAlbumMentions(datos);
    expect(m.map((c) => c.handle)).toEqual([
      "fotografo",
      "maratonsantafe",
      "sponsoruno",
      "compramelafoto",
    ]);
    expect(m[0]!.priority).toBeLessThan(m[1]!.priority);
  });

  it("omite los que no tienen usuario", () => {
    const m = buildAlbumMentions({ ...datos, organizerHandle: null, sponsorHandles: [] });
    expect(m.map((c) => c.handle)).toEqual(["fotografo", "compramelafoto"]);
  });
});

describe("piezas del álbum", () => {
  it("arma un carrusel y una historia", () => {
    const specs = buildAlbumPieceSpecs(datos);
    expect(specs.map((s) => s.format)).toEqual(["CAROUSEL", "STORY"]);
    expect(specs[0]!.pieceId).toBe("clf-album-carousel");
    expect(specs[1]!.pieceId).toBe("clf-album-story");
  });

  it("la historia lleva el link impreso, porque no puede ser tocable", () => {
    const historia = buildAlbumPieceSpecs(datos)[1]!;
    expect(String(historia.values.urlAlbum)).toContain("compramelafoto.com/a/");
  });

  it("la historia es una sola cara: el mosaico no aporta nada acá", () => {
    const historia = buildAlbumPieceSpecs(datos)[1]!;
    const documento = historia.document as DesignDocument;
    expect(documento.sides).toHaveLength(1);
  });

  it("la historia mantiene sus tres bloques de texto impresos, con el marcador correcto", () => {
    const [cara] = ALBUM_STORY_DOCUMENT.sides;
    const textos = cara!.blocks.filter((b) => b.type === "text");
    const contenidos = textos.map((b) => b.content);
    // No importa el orden exacto en el arreglo, importa que los tres marcadores estén: si
    // alguien borra un bloque, esto lo detecta.
    expect(contenidos).toContain("{{nombreAlbum}}");
    expect(contenidos).toContain("{{arrobaFotografo}}");
    expect(contenidos).toContain("{{urlAlbum}}");
    expect(textos).toHaveLength(3);
  });

  // Corrección al brief original: el carrusel no es un documento fijo de 4 huecos en una
  // cara (eso sería un collage). PNG_PER_SIDE emite un PNG por cara (ver emit.ts), así que
  // el documento tiene que tener tantas caras como fotos eligió el fotógrafo, ni una más
  // ni una menos: una cara de más con una foto vacía detiene la emisión (ResourceResolver
  // devuelve null, ver resources.ts).
  it("el carrusel tiene una cara por cada foto elegida, con 3 fotos", () => {
    const tresFotos = { ...datos, photoUrls: datos.photoUrls.slice(0, 3) };
    const specs = buildAlbumPieceSpecs(tresFotos);
    const carrusel = specs[0]!.document as DesignDocument;
    expect(carrusel.sides).toHaveLength(3);
  });

  it("el carrusel tiene una cara por cada foto elegida, con 4 fotos", () => {
    const cuatroFotos = {
      ...datos,
      photoUrls: [...datos.photoUrls, "https://cdn.test/4.jpg"],
    };
    const specs = buildAlbumPieceSpecs(cuatroFotos);
    const carrusel = specs[0]!.document as DesignDocument;
    expect(carrusel.sides).toHaveLength(4);
  });

  it("cada cara del carrusel referencia una única foto propia", () => {
    const documento = albumCarouselDocument(4);
    const variableKeys = documento.sides.map((cara) => {
      const [bloque] = cara.blocks;
      return bloque && bloque.type === "image" ? bloque.variableKey : undefined;
    });
    expect(variableKeys).toEqual(["foto1", "foto2", "foto3", "foto4"]);
  });
});

describe("contratos por pieza", () => {
  it("el contrato de la historia no declara foto2 ni foto3: la historia no las usa", () => {
    const claves = ALBUM_STORY_CONTRACT.variables.map((v) => v.key);
    expect(claves).not.toContain("foto2");
    expect(claves).not.toContain("foto3");
    expect(claves).toContain("foto1");
  });

  it("albumCarouselContract(3) declara foto1, foto2 y foto3 como obligatorias, y no foto4", () => {
    const contrato = albumCarouselContract(3);
    const porClave = new Map(contrato.variables.map((v) => [v.key, v]));
    expect(porClave.get("foto1")?.required).toBe(true);
    expect(porClave.get("foto2")?.required).toBe(true);
    expect(porClave.get("foto3")?.required).toBe(true);
    expect(porClave.has("foto4")).toBe(false);
  });

  /**
   * Documento y contrato tienen que coincidir en las dos direcciones, para 3 y para 4
   * fotos: toda variable obligatoria del contrato aparece usada en el documento (si no,
   * `validateForPublish` la rechaza por declarada-pero-no-usada) y toda variable que el
   * documento usa está declarada en el contrato (si no, `validateForPublish` la rechaza
   * por usada-pero-no-declarada). Esto es lo que impide que se desincronicen de nuevo.
   */
  it.each([3, 4])("el carrusel de %i fotos y su contrato coinciden exactamente", (cantidad) => {
    const documento = albumCarouselDocument(cantidad);
    const contrato = albumCarouselContract(cantidad);
    const usadas = usedVariableKeys(documento);
    const declaradas = new Set(contrato.variables.map((v) => v.key));

    for (const decl of contrato.variables) {
      if (decl.required) {
        expect(usadas.has(decl.key)).toBe(true);
      }
    }
    for (const clave of usadas) {
      expect(declaradas.has(clave)).toBe(true);
    }
  });

  it("la historia y su contrato coinciden: lo obligatorio se usa, lo usado está declarado", () => {
    const usadas = usedVariableKeys(ALBUM_STORY_DOCUMENT);
    const declaradas = new Set(ALBUM_STORY_CONTRACT.variables.map((v) => v.key));

    for (const decl of ALBUM_STORY_CONTRACT.variables) {
      if (decl.required) {
        expect(usadas.has(decl.key)).toBe(true);
      }
    }
    for (const clave of usadas) {
      expect(declaradas.has(clave)).toBe(true);
    }
  });
});

describe("privacidad", () => {
  const contratos: Array<{ nombre: string; contrato: VariableContract }> = [
    { nombre: "carrusel (3 fotos)", contrato: albumCarouselContract(3) },
    { nombre: "carrusel (4 fotos)", contrato: albumCarouselContract(4) },
    { nombre: "historia", contrato: ALBUM_STORY_CONTRACT },
  ];

  it.each(contratos)("$nombre no declara ninguna variable de documento", ({ contrato }) => {
    const claves = contrato.variables.map((v) => v.key.toLowerCase());
    for (const prohibida of ["documento", "dni", "documentnumber", "documenttype"]) {
      expect(claves.some((k) => k.includes(prohibida))).toBe(false);
    }
  });
});
