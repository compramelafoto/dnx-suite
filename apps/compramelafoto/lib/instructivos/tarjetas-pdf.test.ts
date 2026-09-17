import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { buildTarjetasPdf } from "./tarjetas-pdf";
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

describe("buildTarjetasPdf", () => {
  it("genera una hoja A4 válida", async () => {
    const p = perfil();
    const pdf = await buildTarjetasPdf(p, await buildQrPng(p.album.url, 600));
    assert.equal(Buffer.from(pdf.subarray(0, 5)).toString("latin1"), "%PDF-");
  });

  it("un título larguísimo no desborda la tarjeta", async () => {
    const p = perfil({
      album: {
        ...perfil().album,
        titulo: "Campeonato Provincial de Atletismo Sub-18 Jornada de clasificación",
      },
    });
    const pdf = await buildTarjetasPdf(p, await buildQrPng(p.album.url, 600));
    assert.equal(Buffer.from(pdf.subarray(0, 5)).toString("latin1"), "%PDF-");
  });

  it("un logo ilegible no deja al fotógrafo sin tarjetas", async () => {
    const p = perfil();
    const basura = new Uint8Array([9, 9, 9, 9]);
    const pdf = await buildTarjetasPdf(p, await buildQrPng(p.album.url, 600), basura);
    assert.equal(Buffer.from(pdf.subarray(0, 5)).toString("latin1"), "%PDF-");
  });
});
