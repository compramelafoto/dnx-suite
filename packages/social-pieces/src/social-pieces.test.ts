import assert from "node:assert/strict";
import { test } from "node:test";
import { renderSocialPiece } from "./render";
import { buildPublishRequestInput, publishPiece } from "./publish-piece";
import type { RenderedPiece, SocialPieceSpec } from "./types";

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

test("arma la solicitud con formato, colaboradores y menciones sobrantes", () => {
  const input = buildPublishRequestInput(
    {
      application: "COMPRAMELAFOTO",
      entityType: "ALBUM",
      entityId: "42",
      pieceId: "clf-album-carousel",
      format: "CAROUSEL",
      caption: "Las fotos de la Maratón ya están disponibles.",
      hashtags: ["compramelafoto"],
      mentionCandidates: [
        { handle: "fotografo", priority: 1, role: "PHOTOGRAPHER" },
        { handle: "organizador", priority: 2, role: "ORGANIZER" },
        { handle: "sponsor", priority: 3, role: "SPONSOR" },
        { handle: "compramelafoto", priority: 4, role: "PLATFORM" },
      ],
      socialAccountId: "acc1",
      idempotencyKey: "clf:album-carousel:42",
      maxCollaborators: 3,
    },
    ["https://cdn.test/1.jpg", "https://cdn.test/2.jpg", "https://cdn.test/3.jpg"],
  );

  assert.equal(input.idempotencyKey, "clf:album-carousel:42");
  assert.equal(input.assets.length, 3);
  assert.equal(input.assets[0]!.kind, "CAROUSEL_ITEM");
  assert.equal(input.assets[0]!.sortOrder, 0);
  assert.deepEqual(input.mentions, ["compramelafoto"]);
  assert.equal((input.metadata as { format: string }).format, "CAROUSEL");
  assert.deepEqual((input.metadata as { collaborators: string[] }).collaborators, [
    "fotografo",
    "organizador",
    "sponsor",
  ]);
});

test("una historia va como imagen sola y sin colaboradores", () => {
  const input = buildPublishRequestInput(
    {
      application: "COMPRAMELAFOTO",
      entityType: "ALBUM",
      entityId: "42",
      pieceId: "clf-album-story",
      format: "STORY",
      caption: "no se manda",
      mentionCandidates: [{ handle: "fotografo", priority: 1, role: "PHOTOGRAPHER" }],
      socialAccountId: "acc1",
      idempotencyKey: "clf:album-story:42",
    },
    ["https://cdn.test/s.jpg"],
  );

  assert.equal(input.assets[0]!.kind, "IMAGE");
  assert.deepEqual((input.metadata as { collaborators: string[] }).collaborators, []);
  // En una historia nadie se pierde: quien no puede ir etiquetado queda registrado.
  assert.deepEqual(input.mentions, ["fotografo"]);
});

test("la solicitud nace pendiente de aprobación", () => {
  const input = buildPublishRequestInput(
    {
      application: "COMPRAMELAFOTO",
      entityType: "ALBUM",
      entityId: "1",
      pieceId: "p",
      format: "SINGLE_IMAGE",
      caption: "c",
      mentionCandidates: [],
      socialAccountId: "acc1",
      idempotencyKey: "k",
    },
    ["https://cdn.test/a.jpg"],
  );
  assert.equal(input.approvalRequired, true);
});

test("publishPiece sube todas las imágenes de la spec, en orden, y arma la solicitud", async () => {
  const spec: SocialPieceSpec = {
    pieceId: "clf-album-carousel",
    format: "CAROUSEL",
    document: { fake: true },
    contract: { variables: [] },
    values: {},
    resources: { async read() { return null; } },
  };

  const imagenesRenderizadas: RenderedPiece["images"] = [
    { fileName: "carrusel-slide-0.jpg", contentType: "image/jpeg", bytes: new Uint8Array([1]) },
    { fileName: "carrusel-slide-1.jpg", contentType: "image/jpeg", bytes: new Uint8Array([2]) },
    { fileName: "carrusel-slide-2.jpg", contentType: "image/jpeg", bytes: new Uint8Array([3]) },
  ];

  const subidas: string[] = [];
  const upload = async (file: { fileName: string; contentType: string; bytes: Uint8Array }) => {
    subidas.push(file.fileName);
    return `https://cdn.test/${file.fileName}`;
  };

  const input = await publishPiece(
    {
      application: "COMPRAMELAFOTO",
      entityType: "ALBUM",
      entityId: "42",
      pieceId: "clf-album-carousel",
      format: "CAROUSEL",
      caption: "Las fotos de la Maratón ya están disponibles.",
      mentionCandidates: [],
      socialAccountId: "acc1",
      idempotencyKey: "clf:album-carousel:42",
    },
    {
      spec,
      upload,
      render: async () => ({
        images: imagenesRenderizadas,
        rendererVersion: "1.0.0",
        schemaVersion: 1,
        resolvedValues: {},
        omittedVariables: [],
      }),
    },
  );

  // Una llamada a upload por imagen, en el mismo orden: son las diapositivas del carrusel.
  assert.deepEqual(subidas, [
    "carrusel-slide-0.jpg",
    "carrusel-slide-1.jpg",
    "carrusel-slide-2.jpg",
  ]);

  assert.equal(input.assets.length, 3);
  assert.deepEqual(
    input.assets.map((a) => a.publicUrl),
    [
      "https://cdn.test/carrusel-slide-0.jpg",
      "https://cdn.test/carrusel-slide-1.jpg",
      "https://cdn.test/carrusel-slide-2.jpg",
    ],
  );
  assert.deepEqual(
    input.assets.map((a) => a.sortOrder),
    [0, 1, 2],
  );
});
