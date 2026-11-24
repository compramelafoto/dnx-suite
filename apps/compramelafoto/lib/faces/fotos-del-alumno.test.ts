import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { fotosDelAlumno } from "./fotos-del-alumno";

const detecciones = [
  { rekognitionFaceId: "a", photoId: 10 },
  { rekognitionFaceId: "b", photoId: 11 },
  { rekognitionFaceId: "c", photoId: 12 },
  { rekognitionFaceId: "d", photoId: 12 },
  { rekognitionFaceId: "z", photoId: 99 },
];
const album = new Set([1, 10, 11, 12]);

describe("fotosDelAlumno", () => {
  it("la foto tocada va primero aunque no esté entre las coincidencias", () => {
    assert.deepEqual(fotosDelAlumno({ photoId: 1 }, [], detecciones, album), [1]);
  });

  it("ordena las demás de mayor a menor parecido", () => {
    const r = fotosDelAlumno(
      { photoId: 1 },
      [
        { faceId: "a", similarity: 90 },
        { faceId: "b", similarity: 99 },
      ],
      detecciones,
      album,
    );
    assert.deepEqual(r, [1, 11, 10]);
  });

  it("descarta fotos de otros álbumes y caras desconocidas", () => {
    const r = fotosDelAlumno(
      { photoId: 1 },
      [
        { faceId: "z", similarity: 99 },
        { faceId: "nadie", similarity: 98 },
      ],
      detecciones,
      album,
    );
    assert.deepEqual(r, [1]);
  });

  it("dos caras de la misma foto dan una sola entrada", () => {
    const r = fotosDelAlumno(
      { photoId: 1 },
      [
        { faceId: "c", similarity: 95 },
        { faceId: "d", similarity: 80 },
      ],
      detecciones,
      album,
    );
    assert.deepEqual(r, [1, 12]);
  });

  it("la foto de origen no se repite si también coincide", () => {
    const r = fotosDelAlumno({ photoId: 10 }, [{ faceId: "a", similarity: 99 }], detecciones, album);
    assert.deepEqual(r, [10]);
  });
});
