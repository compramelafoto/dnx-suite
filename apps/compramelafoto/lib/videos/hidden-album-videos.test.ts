import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { resolveAllowedVideoIds } from "./hidden-album-videos";

/** Video con sus fotogramas analizados y las caras que se encontraron. */
function v(
  id: number,
  opts: { analizado?: boolean; caras?: string[] } = {}
) {
  return {
    videoId: id,
    hasAnalyzedFrames: opts.analizado ?? true,
    faceIds: opts.caras ?? [],
  };
}

describe("qué videos puede ver quien mandó su selfie", () => {
  it("ve el video donde fue reconocida", () => {
    const r = resolveAllowedVideoIds([v(1, { caras: ["cara-A"] })], ["cara-A"]);
    assert.deepEqual(r.allowedVideoIds, [1]);
    assert.equal(r.matchedCount, 1);
  });

  it("NO ve el video donde aparece otra persona", () => {
    // Esto es lo que protege a los demás: en un acto escolar, cada familia ve
    // lo suyo y no el video de los otros chicos.
    const r = resolveAllowedVideoIds([v(1, { caras: ["cara-OTRA"] })], ["cara-A"]);
    assert.deepEqual(r.allowedVideoIds, []);
  });

  it("ve los videos sin ninguna cara: paisajes, la cancha, detalles", () => {
    const r = resolveAllowedVideoIds([v(9, { caras: [] })], ["cara-A"]);
    assert.deepEqual(r.allowedVideoIds, [9]);
    assert.equal(r.noFaceCount, 1);
  });

  it("NO muestra lo que todavía no se analizó", () => {
    // Un video sin analizar podría tener a cualquiera: mostrarlo sería filtrar
    // material de otras personas por no haber terminado de procesarlo.
    const r = resolveAllowedVideoIds([v(5, { analizado: false, caras: [] })], ["cara-A"]);
    assert.deepEqual(r.allowedVideoIds, []);
    assert.equal(r.pendingCount, 1);
  });

  it("un video con varias personas se muestra si ella es una de ellas", () => {
    const r = resolveAllowedVideoIds(
      [v(3, { caras: ["cara-OTRA", "cara-A", "cara-TERCERA"] })],
      ["cara-A"]
    );
    assert.deepEqual(r.allowedVideoIds, [3]);
  });

  it("mezcla real: ve lo suyo y lo sin caras, no lo ajeno", () => {
    const r = resolveAllowedVideoIds(
      [
        v(1, { caras: ["cara-A"] }),
        v(2, { caras: ["cara-OTRA"] }),
        v(3, { caras: [] }),
        v(4, { analizado: false }),
      ],
      ["cara-A"]
    );
    assert.deepEqual(r.allowedVideoIds.sort(), [1, 3]);
    assert.equal(r.matchedCount, 1);
    assert.equal(r.noFaceCount, 1);
    assert.equal(r.pendingCount, 1);
  });

  it("sin coincidencias sigue viendo los videos sin caras", () => {
    const r = resolveAllowedVideoIds(
      [v(1, { caras: ["cara-OTRA"] }), v(2, { caras: [] })],
      ["cara-A"]
    );
    assert.deepEqual(r.allowedVideoIds, [2]);
    assert.equal(r.matchedCount, 0);
  });

  it("sin caras en la selfie no se abre nada de lo que tiene gente", () => {
    const r = resolveAllowedVideoIds(
      [v(1, { caras: ["cara-OTRA"] }), v(2, { caras: [] })],
      []
    );
    assert.deepEqual(r.allowedVideoIds, [2]);
  });

  it("un álbum sin videos no rompe nada", () => {
    const r = resolveAllowedVideoIds([], ["cara-A"]);
    assert.deepEqual(r.allowedVideoIds, []);
  });

  it("no repite un video que coincide por varias caras", () => {
    const r = resolveAllowedVideoIds(
      [v(7, { caras: ["cara-A", "cara-A2"] })],
      ["cara-A", "cara-A2"]
    );
    assert.deepEqual(r.allowedVideoIds, [7]);
  });
});
