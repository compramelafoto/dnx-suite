import assert from "node:assert/strict";
import { test } from "node:test";
import { renderSocialPiece } from "./render";
import type { SocialPieceSpec } from "./types";

/** PNG de 1×1 rojo, suficiente para que sharp tenga algo real que convertir. */
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const spec: SocialPieceSpec = {
  pieceId: "clf-album-story",
  format: "STORY",
  document: { fake: true },
  contract: { variables: [] },
  values: { nombreAlbum: "Maratón 2026" },
  resources: { async read() { return null; } },
};

test("convierte lo que emite el Designer a JPEG", async () => {
  const pieza = await renderSocialPiece(spec, {
    emit: async () => ({
      ok: true,
      files: [
        {
          name: "story.png",
          contentType: "image/png",
          bytes: new Uint8Array(PNG_1X1),
          checksum: "abc",
        },
      ],
      rendererVersion: "1.0.0",
      schemaVersion: 1,
      resolvedValues: { nombreAlbum: "Maratón 2026" },
      omittedVariables: [],
    }),
  });

  assert.equal(pieza.images.length, 1);
  assert.equal(pieza.images[0]!.contentType, "image/jpeg");
  assert.ok(pieza.images[0]!.fileName.endsWith(".jpg"));
  // Firma de un JPEG: empieza con FF D8 FF.
  assert.equal(pieza.images[0]!.bytes[0], 0xff);
  assert.equal(pieza.images[0]!.bytes[1], 0xd8);
  assert.equal(pieza.images[0]!.bytes[2], 0xff);
});

test("convierte todas las caras del carrusel, no solo la primera", async () => {
  const pieza = await renderSocialPiece(spec, {
    emit: async () => ({
      ok: true,
      files: [
        { name: "carrusel-slide-0.png", contentType: "image/png", bytes: new Uint8Array(PNG_1X1), checksum: "1" },
        { name: "carrusel-slide-1.png", contentType: "image/png", bytes: new Uint8Array(PNG_1X1), checksum: "2" },
        { name: "carrusel-slide-2.png", contentType: "image/png", bytes: new Uint8Array(PNG_1X1), checksum: "3" },
      ],
      rendererVersion: "1.0.0",
      schemaVersion: 1,
      resolvedValues: { nombreAlbum: "Maratón 2026" },
      omittedVariables: [],
    }),
  });

  assert.equal(pieza.images.length, 3);

  // Mismo orden que emitió el Designer.
  assert.deepEqual(
    pieza.images.map((imagen) => imagen.fileName),
    ["carrusel-slide-0.jpg", "carrusel-slide-1.jpg", "carrusel-slide-2.jpg"],
  );

  // Nombres distintos: van a R2 con ese nombre, no pueden colisionar.
  assert.equal(new Set(pieza.images.map((imagen) => imagen.fileName)).size, 3);

  for (const imagen of pieza.images) {
    assert.equal(imagen.contentType, "image/jpeg");
    // Firma de un JPEG: empieza con FF D8 FF.
    assert.equal(imagen.bytes[0], 0xff);
    assert.equal(imagen.bytes[1], 0xd8);
    assert.equal(imagen.bytes[2], 0xff);
  }
});

test("si el Designer falla, el error explica qué faltó", async () => {
  await assert.rejects(
    () =>
      renderSocialPiece(spec, {
        emit: async () => ({ ok: false, errors: ["Falta la variable nombreAlbum."] }),
      }),
    /Falta la variable nombreAlbum/,
  );
});

test("si el Designer no devuelve ninguna cara, falla claro", async () => {
  await assert.rejects(
    () =>
      renderSocialPiece(spec, {
        emit: async () => ({
          ok: true,
          files: [],
          rendererVersion: "1.0.0",
          schemaVersion: 1,
          resolvedValues: {},
          omittedVariables: [],
        }),
      }),
    /no produjo ninguna imagen/,
  );
});

test("guarda los valores resueltos para poder reproducir la pieza", async () => {
  const pieza = await renderSocialPiece(spec, {
    emit: async () => ({
      ok: true,
      files: [
        { name: "s.png", contentType: "image/png", bytes: new Uint8Array(PNG_1X1), checksum: "a" },
      ],
      rendererVersion: "1.2.3",
      schemaVersion: 4,
      resolvedValues: { nombreAlbum: "Maratón 2026" },
      omittedVariables: ["fecha"],
    }),
  });
  assert.equal(pieza.rendererVersion, "1.2.3");
  assert.deepEqual(pieza.resolvedValues, { nombreAlbum: "Maratón 2026" });
});
