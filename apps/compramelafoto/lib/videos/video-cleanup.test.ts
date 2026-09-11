import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  PURGED_ORIGINAL_KEY,
  collectPurgeKeys,
  isAlreadyPurged,
  shouldPurgeVideo,
} from "./video-cleanup";

const ahora = new Date("2026-09-11T12:00:00Z");

function video(over: Partial<Parameters<typeof shouldPurgeVideo>[0]> = {}) {
  return {
    originalKey: "albums/1/videos/original/abc.mp4",
    previewKey: null,
    thumbnailKey: null,
    isRemoved: false,
    expiresAt: new Date("2026-12-01T00:00:00Z"),
    ...over,
  };
}

describe("shouldPurgeVideo", () => {
  it("deja en paz un video vigente que el fotógrafo no borró", () => {
    assert.equal(shouldPurgeVideo(video(), ahora), false);
  });

  it("purga un video cuya ventana de 15 días ya pasó", () => {
    assert.equal(
      shouldPurgeVideo(video({ expiresAt: new Date("2026-09-10T00:00:00Z") }), ahora),
      true
    );
  });

  it("purga un video que el fotógrafo borró, aunque todavía no haya vencido", () => {
    assert.equal(shouldPurgeVideo(video({ isRemoved: true }), ahora), true);
  });

  it("no purga en el instante exacto del vencimiento: recién cuando pasó", () => {
    assert.equal(shouldPurgeVideo(video({ expiresAt: ahora }), ahora), false);
    assert.equal(
      shouldPurgeVideo(video({ expiresAt: new Date(ahora.getTime() - 1) }), ahora),
      true
    );
  });

  it("no vuelve a purgar lo que ya se purgó", () => {
    assert.equal(
      shouldPurgeVideo(
        video({ originalKey: PURGED_ORIGINAL_KEY, isRemoved: true }),
        ahora
      ),
      false
    );
  });
});

describe("isAlreadyPurged", () => {
  it("reconoce el marcador de purgado", () => {
    assert.equal(isAlreadyPurged({ originalKey: PURGED_ORIGINAL_KEY }), true);
  });

  it("trata una key vacía o con espacios como ya purgada", () => {
    assert.equal(isAlreadyPurged({ originalKey: "" }), true);
    assert.equal(isAlreadyPurged({ originalKey: "   " }), true);
  });

  it("no confunde una key real con purgada", () => {
    assert.equal(isAlreadyPurged({ originalKey: "albums/1/videos/original/a.mp4" }), false);
  });
});

describe("collectPurgeKeys", () => {
  it("junta el original, la preview y la miniatura", () => {
    assert.deepEqual(
      collectPurgeKeys(
        video({
          originalKey: "o.mp4",
          previewKey: "p.mp4",
          thumbnailKey: "t.jpg",
        })
      ),
      ["o.mp4", "p.mp4", "t.jpg"]
    );
  });

  it("omite las variantes que nunca se generaron", () => {
    assert.deepEqual(collectPurgeKeys(video({ originalKey: "o.mp4" })), ["o.mp4"]);
  });

  it("no devuelve el marcador de purgado como si fuera un archivo", () => {
    assert.deepEqual(collectPurgeKeys(video({ originalKey: PURGED_ORIGINAL_KEY })), []);
  });

  it("no repite una key que aparezca dos veces", () => {
    assert.deepEqual(
      collectPurgeKeys(video({ originalKey: "a.mp4", previewKey: "a.mp4" })),
      ["a.mp4"]
    );
  });
});
