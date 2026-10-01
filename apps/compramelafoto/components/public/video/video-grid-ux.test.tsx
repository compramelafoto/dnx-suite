import { describe, it } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import PublicAlbumVideosGrid from "./PublicAlbumVideosGrid";
import type { PublicVideoDto } from "@/lib/videos/public-video-dto";

const VIDEO: PublicVideoDto = {
  id: 22,
  title: "Ceremonia",
  description: null,
  category: "CEREMONY",
  categoryLabel: "Ceremonia",
  durationSeconds: 720,
  orientation: "portrait",
  thumbnailUrl: "https://ejemplo/t.jpg",
  previewUrl: "/api/public/videos/22/preview",
  width: 1080,
  height: 1920,
  createdAt: new Date().toISOString(),
  priceArs: 27_600,
  priceLabel: "$27.600",
  purchasable: true,
};

const render = (props: Record<string, unknown> = {}) =>
  renderToStaticMarkup(<PublicAlbumVideosGrid videos={[VIDEO]} {...props} />);

describe("la grilla de videos se comporta como la de fotos", () => {
  it("muestra el precio en la tarjeta, sin tener que ampliar", () => {
    // Antes había que abrir el visor para enterarse de cuánto costaba.
    assert.ok(render({ albumId: 9 }).includes("$27.600"), "no muestra el precio");
  });

  it("tiene la lupa para ver ampliado, igual que las fotos", () => {
    const html = render({ albumId: 9 });
    assert.ok(
      html.includes("Ver ampliado (con marca de agua)"),
      "falta la lupa"
    );
  });

  it("la lupa usa el mismo azul que en las fotos", () => {
    assert.ok(render({ albumId: 9 }).includes("bg-[#2563eb]"));
  });

  it("avisa que lo ampliado lleva marca de agua, como en fotos", () => {
    assert.ok(render({ albumId: 9 }).includes("marca de agua"));
  });

  it("sin álbum no ofrece elegir: es sólo un visor", () => {
    // Caso de las galerías de evento.
    const html = render();
    assert.ok(!html.includes("Seleccionado"));
  });

  it("un video fuera de venta no muestra precio", () => {
    const html = renderToStaticMarkup(
      <PublicAlbumVideosGrid
        videos={[{ ...VIDEO, purchasable: false, priceLabel: null, priceArs: null }]}
        albumId={9}
      />
    );
    assert.ok(!html.includes("$27.600"));
  });

  it("sin videos lo dice en vez de dejar la pantalla vacía", () => {
    const html = renderToStaticMarkup(<PublicAlbumVideosGrid videos={[]} albumId={9} />);
    assert.ok(html.includes("No hay videos"));
  });
});
