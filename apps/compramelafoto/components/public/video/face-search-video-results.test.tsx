import { describe, it } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import FaceSearchVideoResults from "./FaceSearchVideoResults";
import type { VideoSelfieHit } from "@/lib/videos/video-frame-matching";

const HIT: VideoSelfieHit = {
  videoId: 21,
  timeSeconds: 272,
  similarity: 95,
  frameHits: 3,
  title: "Ceremonia",
  categoryLabel: "Ceremonia",
  durationSeconds: 720,
  thumbnailUrl: "https://ejemplo/t.jpg",
  previewUrl: "https://ejemplo/p.mp4",
  timestampLabel: "4:32",
};

const render = (videos: VideoSelfieHit[]) =>
  renderToStaticMarkup(<FaceSearchVideoResults videos={videos} />);

describe("resultados de video de la búsqueda por selfie", () => {
  it("dice el minuto exacto donde aparece la persona", () => {
    // Esto es lo que ninguna otra plataforma del rubro ofrece.
    const html = render([HIT]);
    assert.ok(html.includes("4:32"), "no muestra el minuto");
    assert.ok(html.includes("Aparecés en el minuto"), "no explica qué es ese número");
  });

  it("sin videos no ocupa lugar en la pantalla", () => {
    assert.equal(render([]), "");
  });

  it("con un video habla en singular", () => {
    assert.ok(render([HIT]).includes("aparecés en un video"));
  });

  it("con varios dice cuántos", () => {
    const html = render([HIT, { ...HIT, videoId: 22, timestampLabel: "0:15" }]);
    assert.ok(html.includes("aparecés en 2 videos"));
  });

  it("si el video no tiene título usa la categoría", () => {
    const html = render([{ ...HIT, title: null }]);
    assert.ok(html.includes("Ceremonia"));
    assert.ok(!html.includes("null"));
  });

  it("sin miniatura no rompe: deja el espacio reservado", () => {
    const html = render([{ ...HIT, thumbnailUrl: null }]);
    assert.ok(!html.includes("<img"), "intenta mostrar una imagen que no existe");
    assert.ok(html.includes("4:32"), "perdió el resto de la información");
  });

  it("no expone datos internos de la coincidencia", () => {
    // similarity y frameHits son señales del algoritmo, no información útil
    // para el cliente: verlas sólo genera desconfianza.
    const html = render([HIT]);
    assert.ok(!html.includes("95"), "expone el porcentaje de similitud");
    assert.ok(!html.includes("frameHits"));
  });
});
