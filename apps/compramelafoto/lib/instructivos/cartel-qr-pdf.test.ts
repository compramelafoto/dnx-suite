import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { buildCartelQrPdf, lineaDeAccion } from "./cartel-qr-pdf";
import { buildQrPng } from "./instructivo-qr";
import type { AlbumInstructivoProfile } from "./album-instructivo-profile";

function perfil(over: Partial<AlbumInstructivoProfile> = {}): AlbumInstructivoProfile {
  return {
    entrada: "abierta",
    busqueda: ["cara", "navegar"],
    momento: "postventa",
    venta: {
      digital: true,
      impreso: false,
      packs: false,
      video: false,
      digitalIncluidoConImpreso: false,
    },
    entrega: { descarga: true, retiro: false, envio: false, laboratorio: null },
    vencimiento: null,
    listo: true,
    fotografo: { nombre: "Estudio DNX", logoUrl: null, color: "#c27b3d", handler: "dnx" },
    album: {
      id: 1,
      titulo: "Maratón 2026",
      slug: "maraton-2026",
      url: "https://compramelafoto.com/a/maraton-2026",
    },
    ...over,
  };
}

describe("lineaDeAccion", () => {
  it("con selfie obligatoria nombra la selfie", () => {
    assert.match(lineaDeAccion(perfil({ entrada: "selfie_obligatoria" })), /selfie/i);
  });

  it("con dorsales nombra el número", () => {
    assert.match(lineaDeAccion(perfil({ busqueda: ["dorsal", "navegar"] })), /número/i);
  });

  it("nombra la selfie aunque el análisis facial no haya encontrado caras todavía", () => {
    const linea = lineaDeAccion(perfil({ busqueda: ["dorsal", "palabra", "navegar"] }));
    assert.equal(
      linea,
      "Escaneá el código y buscá tus fotos con una selfie, tu número o palabra clave"
    );
  });

  it("en preventa habla de reservar, no de mirar", () => {
    assert.match(lineaDeAccion(perfil({ momento: "preventa" })), /reserv/i);
  });

  it("sin fotos todavía, invita a guardar el enlace", () => {
    assert.match(lineaDeAccion(perfil({ momento: "simple" })), /guard/i);
  });
});

describe("buildCartelQrPdf", () => {
  it("genera un A4 válido", async () => {
    const p = perfil();
    const pdf = await buildCartelQrPdf(p, await buildQrPng(p.album.url, 960), "a4");
    assert.equal(Buffer.from(pdf.subarray(0, 5)).toString("latin1"), "%PDF-");
  });

  it("genera un A5 válido", async () => {
    const p = perfil();
    const pdf = await buildCartelQrPdf(p, await buildQrPng(p.album.url, 960), "a5");
    assert.equal(Buffer.from(pdf.subarray(0, 5)).toString("latin1"), "%PDF-");
  });

  it("un título larguísimo no rompe el cartel", async () => {
    const p = perfil({
      album: {
        ...perfil().album,
        titulo: "Campeonato Provincial de Atletismo Sub-18 · Jornada de clasificación general",
      },
    });
    const pdf = await buildCartelQrPdf(p, await buildQrPng(p.album.url, 960), "a5");
    assert.equal(Buffer.from(pdf.subarray(0, 5)).toString("latin1"), "%PDF-");
  });

  it("un logo ilegible no deja al fotógrafo sin cartel", async () => {
    const p = perfil();
    const basura = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const pdf = await buildCartelQrPdf(p, await buildQrPng(p.album.url, 960), "a4", basura);
    assert.equal(Buffer.from(pdf.subarray(0, 5)).toString("latin1"), "%PDF-");
  });
});
