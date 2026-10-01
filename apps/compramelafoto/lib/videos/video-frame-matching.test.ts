import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  formatVideoTimestamp,
  frameExternalImageId,
  parseFrameExternalImageId,
  summarizeVideoMatches,
} from "./video-frame-matching";

describe("identificador del fotograma para Amazon", () => {
  it("ida y vuelta", () => {
    assert.equal(parseFrameExternalImageId(frameExternalImageId(42)), 42);
  });

  it("no confunde el id de una foto con el de un fotograma", () => {
    // Las fotos se indexan con el número pelado: no debe parecer un fotograma.
    assert.equal(parseFrameExternalImageId("1234"), null);
  });

  it("ignora valores vacíos o sin número", () => {
    assert.equal(parseFrameExternalImageId(null), null);
    assert.equal(parseFrameExternalImageId(undefined), null);
    assert.equal(parseFrameExternalImageId(""), null);
    assert.equal(parseFrameExternalImageId("vf_"), null);
    assert.equal(parseFrameExternalImageId("vf_abc"), null);
    assert.equal(parseFrameExternalImageId("vf_-3"), null);
    assert.equal(parseFrameExternalImageId("vf_0"), null);
  });

  it("sólo usa caracteres que Amazon acepta", () => {
    assert.match(frameExternalImageId(7), /^[a-zA-Z0-9_.:-]+$/);
  });
});

describe("summarizeVideoMatches", () => {
  it("sin coincidencias devuelve lista vacía", () => {
    assert.deepEqual(summarizeVideoMatches([]), []);
  });

  it("se queda con el fotograma donde mejor se reconoce a la persona", () => {
    const out = summarizeVideoMatches([
      { videoId: 1, timeSeconds: 10, similarity: 72 },
      { videoId: 1, timeSeconds: 272, similarity: 95 },
      { videoId: 1, timeSeconds: 40, similarity: 80 },
    ]);
    assert.equal(out.length, 1);
    assert.equal(out[0]!.timeSeconds, 272);
    assert.equal(out[0]!.similarity, 95);
    assert.equal(out[0]!.frameHits, 3);
  });

  it("agrupa por video y ordena por parecido", () => {
    const out = summarizeVideoMatches([
      { videoId: 1, timeSeconds: 5, similarity: 75 },
      { videoId: 2, timeSeconds: 8, similarity: 91 },
    ]);
    assert.deepEqual(
      out.map((m) => m.videoId),
      [2, 1]
    );
  });

  it("con el mismo parecido gana el que aparece en más fotogramas", () => {
    const out = summarizeVideoMatches([
      { videoId: 1, timeSeconds: 5, similarity: 88 },
      { videoId: 2, timeSeconds: 8, similarity: 88 },
      { videoId: 2, timeSeconds: 9, similarity: 80 },
    ]);
    assert.equal(out[0]!.videoId, 2);
  });
});

describe("formatVideoTimestamp", () => {
  it("muestra minutos y segundos con dos dígitos", () => {
    assert.equal(formatVideoTimestamp(272), "4:32");
    assert.equal(formatVideoTimestamp(5), "0:05");
    assert.equal(formatVideoTimestamp(60), "1:00");
    assert.equal(formatVideoTimestamp(0), "0:00");
  });

  it("trunca los decimales en vez de redondear para arriba", () => {
    assert.equal(formatVideoTimestamp(59.9), "0:59");
  });

  it("no rompe con un valor negativo", () => {
    assert.equal(formatVideoTimestamp(-4), "0:00");
  });
});
