import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FACE_SEARCH_DEFAULT,
  FACE_SEARCH_PERSON_PHOTOS,
  normalizeFaceSearchLimits,
} from "./face-search-limits";

test("la selfie de una persona pide muchas más caras que el uso interno", () => {
  assert.ok(FACE_SEARCH_PERSON_PHOTOS.maxFaces >= 500);
  assert.ok(FACE_SEARCH_PERSON_PHOTOS.faceMatchThreshold >= FACE_SEARCH_DEFAULT.faceMatchThreshold);
  assert.deepEqual(normalizeFaceSearchLimits(FACE_SEARCH_PERSON_PHOTOS), FACE_SEARCH_PERSON_PHOTOS);
});

test("sin límites usa lo de siempre (20 caras, 70%)", () => {
  assert.deepEqual(normalizeFaceSearchLimits(), { maxFaces: 20, faceMatchThreshold: 70 });
});

test("respeta los topes de Rekognition", () => {
  assert.deepEqual(normalizeFaceSearchLimits({ maxFaces: 99999, faceMatchThreshold: 150 }), {
    maxFaces: 4096,
    faceMatchThreshold: 100,
  });
  assert.deepEqual(normalizeFaceSearchLimits({ maxFaces: 0, faceMatchThreshold: -1 }), {
    maxFaces: 1,
    faceMatchThreshold: 0,
  });
});
