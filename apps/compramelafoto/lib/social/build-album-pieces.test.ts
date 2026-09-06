import { describe, expect, it } from "vitest";
import type { DesignDocument } from "@repo/design-studio";
import {
  buildAlbumCaption,
  buildAlbumMentions,
  buildAlbumPieceSpecs,
} from "./build-album-pieces";
import { ALBUM_VARIABLE_CONTRACT, albumCarouselDocument } from "./album-piece-templates";

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

describe("privacidad", () => {
  it("el contrato no declara ninguna variable de documento", () => {
    const claves = ALBUM_VARIABLE_CONTRACT.variables.map((v) => v.key.toLowerCase());
    for (const prohibida of ["documento", "dni", "documentnumber", "documenttype"]) {
      expect(claves.some((k) => k.includes(prohibida))).toBe(false);
    }
  });
});
