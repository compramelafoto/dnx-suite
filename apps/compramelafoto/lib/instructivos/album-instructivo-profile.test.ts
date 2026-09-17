import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  resolveAlbumInstructivoProfile,
  type AlbumInstructivoProfileInput,
} from "./album-instructivo-profile";

const AHORA = new Date("2026-09-17T12:00:00Z");

function baseInput(): AlbumInstructivoProfileInput {
  return {
    album: {
      id: 1,
      title: "Maratón 2026",
      publicSlug: "maraton-2026",
      isPublic: true,
      isHidden: false,
      hiddenPhotosEnabled: false,
      preCompraCloseAt: null,
      enableDigitalPhotos: true,
      enablePrintedPhotos: false,
      includeDigitalWithPrint: false,
      deliveryType: null,
      pickupBy: null,
      expiresAt: new Date("2026-11-01T00:00:00Z"),
    },
    fotografo: { nombre: "Estudio DNX", logoUrl: null, primaryColor: null, handler: "dnx" },
    senales: {
      fotosCargadas: 500,
      rostrosDetectados: 320,
      tokensNumericos: 0,
      tokensDeTexto: 0,
      packsPreventaActivos: 0,
      packsGaleriaActivos: 0,
      videosPublicados: 0,
      laboratorio: null,
      listo: true,
    },
    baseUrl: "https://compramelafoto.com",
    ahora: AHORA,
  };
}

describe("resolveAlbumInstructivoProfile", () => {
  it("una galería abierta con rostros ofrece cara y navegar", () => {
    const p = resolveAlbumInstructivoProfile(baseInput());
    assert.equal(p.entrada, "abierta");
    assert.deepEqual(p.busqueda, ["cara", "navegar"]);
    assert.equal(p.momento, "postventa");
  });

  it("con selfie obligatoria, el reconocimiento facial es el único método", () => {
    const input = baseInput();
    input.album.hiddenPhotosEnabled = true;
    input.senales.tokensNumericos = 90;
    const p = resolveAlbumInstructivoProfile(input);
    assert.equal(p.entrada, "selfie_obligatoria");
    assert.deepEqual(p.busqueda, ["cara"]);
  });

  it("los dorsales aparecen cuando hay tokens numéricos", () => {
    const input = baseInput();
    input.senales.tokensNumericos = 90;
    input.senales.tokensDeTexto = 12;
    const p = resolveAlbumInstructivoProfile(input);
    assert.deepEqual(p.busqueda, ["cara", "dorsal", "palabra", "navegar"]);
  });

  it("un cierre de pre-compra en el futuro marca preventa", () => {
    const input = baseInput();
    input.album.preCompraCloseAt = new Date("2026-10-01T00:00:00Z");
    assert.equal(resolveAlbumInstructivoProfile(input).momento, "preventa");
  });

  it("un cierre de pre-compra ya pasado no es preventa", () => {
    const input = baseInput();
    input.album.preCompraCloseAt = new Date("2026-09-01T00:00:00Z");
    assert.equal(resolveAlbumInstructivoProfile(input).momento, "postventa");
  });

  it("sin fotos cargadas el álbum es simple", () => {
    const input = baseInput();
    input.senales.fotosCargadas = 0;
    input.senales.rostrosDetectados = 0;
    const p = resolveAlbumInstructivoProfile(input);
    assert.equal(p.momento, "simple");
    assert.deepEqual(p.busqueda, ["navegar"]);
  });

  it("un álbum oculto o no listado se marca no_listada", () => {
    const input = baseInput();
    input.album.isPublic = false;
    assert.equal(resolveAlbumInstructivoProfile(input).entrada, "no_listada");
  });

  it("arma la dirección pública del álbum", () => {
    const p = resolveAlbumInstructivoProfile(baseInput());
    assert.equal(p.album.url, "https://compramelafoto.com/a/maraton-2026");
  });

  it("no habla de retiro si el álbum no vende fotos impresas", () => {
    const input = baseInput();
    input.album.enablePrintedPhotos = false;
    input.album.pickupBy = "PHOTOGRAPHER";
    const p = resolveAlbumInstructivoProfile(input);
    assert.equal(p.entrega.retiro, false);
    assert.equal(p.entrega.envio, false);
  });

  it("el retiro aparece cuando sí vende impresas", () => {
    const input = baseInput();
    input.album.enablePrintedPhotos = true;
    input.album.pickupBy = "PHOTOGRAPHER";
    assert.equal(resolveAlbumInstructivoProfile(input).entrega.retiro, true);
  });

  it("tampoco nombra el laboratorio si no vende impresas", () => {
    const input = baseInput();
    input.album.enablePrintedPhotos = false;
    input.senales.laboratorio = "Laboratorio Norte";
    assert.equal(resolveAlbumInstructivoProfile(input).entrega.laboratorio, null);
  });

  it("propaga el estado de análisis sin inventarlo", () => {
    const input = baseInput();
    input.senales.listo = false;
    assert.equal(resolveAlbumInstructivoProfile(input).listo, false);
  });
});
