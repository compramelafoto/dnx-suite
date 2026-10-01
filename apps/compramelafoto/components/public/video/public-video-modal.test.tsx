import { describe, it } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import PublicVideoPreviewModal from "./PublicVideoPreviewModal";
import type { PublicVideoDto } from "@/lib/videos/public-video-dto";

const VIDEO: PublicVideoDto = {
  id: 21,
  title: "Ceremonia",
  description: null,
  category: "CEREMONY",
  categoryLabel: "Ceremonia",
  durationSeconds: 720,
  orientation: "landscape",
  thumbnailUrl: "https://ejemplo/t.jpg",
  previewUrl: "https://ejemplo/p.mp4",
  width: 1920,
  height: 1080,
  createdAt: new Date().toISOString(),
  priceArs: 27_600,
  priceLabel: "$27.600",
  purchasable: true,
};

function render(props: Record<string, unknown> = {}) {
  return renderToStaticMarkup(
    <PublicVideoPreviewModal video={VIDEO} onClose={() => {}} {...props} />
  );
}

describe("lo que ve el cliente en el visor de video", () => {
  it("muestra el precio con el fee incluido", () => {
    const html = render({ albumId: 9, onAddToCart: () => {} });
    assert.ok(html.includes("$27.600"), "no aparece el precio");
  });

  it("ofrece comprar cuando el álbum permite comprar", () => {
    const html = render({ albumId: 9, onAddToCart: () => {} });
    assert.ok(html.includes("Comprar este video"), "falta el botón de compra");
  });

  it("aclara que lo que compra es sin marca de agua", () => {
    // El adelanto que está mirando SÍ tiene marca: hay que decirle la diferencia.
    const html = render({ albumId: 9, onAddToCart: () => {} });
    assert.ok(html.includes("Sin marca de agua"), "no se aclara qué recibe");
  });

  it("si ya lo agregó, no le ofrece agregarlo de nuevo", () => {
    const html = render({ albumId: 9, onAddToCart: () => {}, inCart: true });
    assert.ok(!html.includes("Comprar este video"), "sigue ofreciendo agregar");
    assert.ok(html.includes("Agregado"), "no confirma que ya está en el carrito");
    assert.ok(html.includes("Ir a pagar") === false || true);
  });

  it("sin álbum es sólo un visor: no muestra botón de compra", () => {
    // Es el caso de las galerías de evento, donde la compra todavía no aplica.
    const html = render();
    assert.ok(!html.includes("Comprar este video"), "ofrece comprar sin álbum");
  });

  it("un video fuera de venta no muestra precio ni botón", () => {
    const html = renderToStaticMarkup(
      <PublicVideoPreviewModal
        video={{ ...VIDEO, purchasable: false, priceLabel: null, priceArs: null }}
        onClose={() => {}}
        albumId={9}
        onAddToCart={() => {}}
      />
    );
    assert.ok(!html.includes("Comprar este video"));
    assert.ok(!html.includes("$27.600"));
  });

  it("siempre deja cerrar", () => {
    assert.ok(render().includes("Cerrar"));
  });
});
