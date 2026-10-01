import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { buildInstructivoPdf } from "./instructivo-pdf";
import { buildInstructivoSteps } from "./album-instructivo-steps";
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
    vencimiento: new Date("2026-11-01T00:00:00Z"),
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

async function generar(p: AlbumInstructivoProfile): Promise<Uint8Array> {
  const qr = await buildQrPng(p.album.url, 480);
  return buildInstructivoPdf(p, buildInstructivoSteps(p), qr);
}

describe("buildInstructivoPdf", () => {
  it("devuelve un PDF válido", async () => {
    const pdf = await generar(perfil());
    assert.equal(Buffer.from(pdf.subarray(0, 5)).toString("latin1"), "%PDF-");
  });

  it("un título con emoji no rompe la emisión", async () => {
    // Las fuentes estándar de PDF son Latin-1: sin el filtrado, un emoji en el título
    // que escribió el fotógrafo haría fallar el PDF entero.
    const pdf = await generar(perfil({ album: { ...perfil().album, titulo: "Maratón 🏃 2026" } }));
    assert.equal(Buffer.from(pdf.subarray(0, 5)).toString("latin1"), "%PDF-");
  });

  it("un instructivo largo de preventa con selfie sigue saliendo entero", async () => {
    const largo = perfil({
      momento: "preventa",
      entrada: "selfie_obligatoria",
      busqueda: ["cara"],
      listo: false,
      venta: {
        digital: true,
        impreso: true,
        packs: true,
        video: true,
        digitalIncluidoConImpreso: true,
      },
      entrega: { descarga: true, retiro: true, envio: false, laboratorio: "Laboratorio Norte" },
    });
    const pdf = await generar(largo);
    assert.equal(Buffer.from(pdf.subarray(0, 5)).toString("latin1"), "%PDF-");
    assert.ok(pdf.byteLength > 1000);
  });

  it("un logo que no se puede bajar no deja al cliente sin instructivo", async () => {
    const p = perfil();
    const pdf = await generar({
      ...p,
      fotografo: { ...p.fotografo, logoUrl: "https://no-existe.invalid/logo.png" },
    });
    assert.equal(Buffer.from(pdf.subarray(0, 5)).toString("latin1"), "%PDF-");
  });

  it("un color de marca inválido no rompe nada", async () => {
    const p = perfil();
    const pdf = await generar({ ...p, fotografo: { ...p.fotografo, color: "no-es-un-color" } });
    assert.equal(Buffer.from(pdf.subarray(0, 5)).toString("latin1"), "%PDF-");
  });
});
