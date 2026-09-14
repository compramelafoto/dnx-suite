import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  buildPreviewScaleFilter,
  buildRotationFilter,
  visualDimensionsFromRaw,
} from "./ffmpeg.js";

describe("rotación de videos verticales", () => {
  it("NO agrega un giro propio: ffmpeg ya rota al decodificar", () => {
    // El bug real: un video de celular llega 1920x1080 con rotation=90 en el
    // metadata. ffmpeg lo decodifica ya derecho (1080x1920), y el transpose que
    // agregaba el worker lo volvía a acostar. Resultado en producción: 720x406,
    // horizontal, con la cara de costado.
    const filtro = buildPreviewScaleFilter("portrait", 90);
    assert.ok(
      !filtro.includes("transpose"),
      `el filtro vuelve a girar el video: ${filtro}`
    );
  });

  it("tampoco gira con 270 ni con 180", () => {
    for (const rot of [180, 270, -90]) {
      assert.ok(!buildPreviewScaleFilter("portrait", rot).includes("transpose"));
    }
  });

  it("un video vertical se escala por el ancho", () => {
    const filtro = buildPreviewScaleFilter("portrait", 90);
    assert.ok(filtro.includes("scale=720:-2"), filtro);
  });

  it("un video horizontal se escala por el alto", () => {
    const filtro = buildPreviewScaleFilter("landscape", 0);
    assert.ok(filtro.includes("scale=-2:720"), filtro);
  });

  it("las dimensiones visuales siguen teniendo en cuenta la rotación", () => {
    // Esto NO cambia: es lo que decide si el video es vertical u horizontal, y
    // estaba bien. Lo que sobraba era el giro extra en el filtro.
    const v = visualDimensionsFromRaw(1920, 1080, 90);
    assert.equal(v.visualWidth, 1080);
    assert.equal(v.visualHeight, 1920);
  });

  it("buildRotationFilter queda para casos donde el giro sea explícito", () => {
    // Se conserva porque sigue siendo correcta como función; lo que se sacó es
    // su uso automático en el filtro del preview.
    assert.equal(buildRotationFilter(90), "transpose=1");
    assert.equal(buildRotationFilter(0), null);
  });
});
