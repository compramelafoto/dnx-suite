import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { resolvePreviewResponseCache } from "./preview-response-cache";

describe("cómo se devuelve el adelanto de un video", () => {
  it("un fragmento se devuelve como 206, nunca como 200", () => {
    // El bug que rompía la reproducción en iPhone: 200 con Content-Range.
    const r = resolvePreviewResponseCache({
      requestedRange: "bytes=0-1023",
      upstreamStatus: 206,
      hasContentRange: true,
    });
    assert.equal(r.status, 206);
  });

  it("corrige el 200 de origen cuando la respuesta es un fragmento", () => {
    const r = resolvePreviewResponseCache({
      requestedRange: "bytes=0-1023",
      upstreamStatus: 200,
      hasContentRange: true,
    });
    assert.equal(r.status, 206);
  });

  it("el fragmento NO se puede cachear en el CDN compartido", () => {
    // Esta es la línea que causó el problema en producción: con `public`, el
    // CDN guardaba el fragmento y lo repartía como 200.
    const r = resolvePreviewResponseCache({
      requestedRange: "bytes=0-1023",
      upstreamStatus: 206,
      hasContentRange: true,
    });
    assert.match(r.cacheControl, /^private,/);
    assert.doesNotMatch(r.cacheControl, /public/);
  });

  it("la respuesta entera tampoco se cachea compartida", () => {
    // Si el CDN guardara la entera, después se la daría a un reproductor que
    // pidió un rango, y el salto en la línea de tiempo dejaría de funcionar.
    const r = resolvePreviewResponseCache({
      requestedRange: null,
      upstreamStatus: 200,
      hasContentRange: false,
    });
    assert.equal(r.status, 200);
    assert.doesNotMatch(r.cacheControl, /public/);
  });

  it("siempre avisa que la respuesta depende del rango pedido", () => {
    for (const caso of [
      { requestedRange: null, upstreamStatus: 200, hasContentRange: false },
      { requestedRange: "bytes=0-99", upstreamStatus: 206, hasContentRange: true },
    ]) {
      assert.equal(resolvePreviewResponseCache(caso).vary, "Range");
    }
  });

  it("el navegador sí puede guardarlo: el adelanto no cambia nunca", () => {
    const r = resolvePreviewResponseCache({
      requestedRange: null,
      upstreamStatus: 200,
      hasContentRange: false,
    });
    assert.match(r.cacheControl, /max-age=3600/);
  });

  it("pidió un rango pero le mandaron todo: se respeta el 200", () => {
    // R2 puede ignorar un rango imposible y devolver el archivo completo.
    const r = resolvePreviewResponseCache({
      requestedRange: "bytes=0-",
      upstreamStatus: 200,
      hasContentRange: false,
    });
    assert.equal(r.status, 200);
  });
});
