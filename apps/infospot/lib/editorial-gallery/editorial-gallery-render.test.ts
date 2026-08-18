/**
 * Parseo (React children → RawGallery) y resolución (RawGallery + photoById
 * → ResolvedGallery) del bloque de galería en el render público/preview.
 * Ejecutar: pnpm --filter @repo/db exec tsx ../../apps/infospot/lib/editorial-gallery/editorial-gallery-render.test.ts
 */

import assert from "node:assert/strict";
import { createElement } from "react";
import {
  extractGalleryImagesFromChildren,
  parseGalleryFigureAttrs,
} from "./parse-gallery-figure";
import { resolveGalleryForRender } from "./resolve-gallery";
import type { PublicEditorialPhotoViewModel } from "../public-coverage/types";

function mockPhoto(
  overrides: Partial<PublicEditorialPhotoViewModel> = {},
): PublicEditorialPhotoViewModel {
  return {
    id: "photo-1",
    usageType: "INLINE",
    sortOrder: 0,
    caption: null,
    altText: "Foto CLF",
    displaySize: "wide",
    photographerName: "Fotógrafo X",
    credit: "Foto: Fotógrafo X",
    src: "https://cdn.compramelafoto.example/derivado.jpg",
    srcSet: null,
    sizes: "100vw",
    widthHint: 1200,
    revoked: false,
    unavailable: false,
    canShowPurchaseCta: true,
    purchaseHref: "https://compramelafoto.com/foto/1",
    albumHref: "https://compramelafoto.com/album/x",
    hasSpecificPurchaseUrl: true,
    photographerProfileHref: null,
    focalX: null,
    focalY: null,
    ...overrides,
  };
}

// --- 1. parseGalleryFigureAttrs lee kebab-case ---
{
  const attrs = parseGalleryFigureAttrs({
    "data-gallery-id": "g1",
    "data-gallery-title": "Título",
    "data-autoplay": "false",
    "data-interval-ms": "7000",
    "data-loop": "false",
  });
  assert.equal(attrs.id, "g1");
  assert.equal(attrs.title, "Título");
  assert.equal(attrs.autoplay, false);
  assert.equal(attrs.intervalMs, 7000);
  assert.equal(attrs.loop, false);
}

// --- 2. parseGalleryFigureAttrs lee camelCase (variante de rehype-sanitize) ---
{
  const attrs = parseGalleryFigureAttrs({
    dataGalleryId: "g2",
    dataAutoplay: "true",
    dataLoop: "true",
  });
  assert.equal(attrs.id, "g2");
  assert.equal(attrs.autoplay, true);
  assert.equal(attrs.loop, true);
  assert.equal(attrs.intervalMs, 5000, "default cuando falta data-interval-ms");
}

// --- 3. extractGalleryImagesFromChildren recorre ol > li > img ---
{
  const tree = createElement(
    "ol",
    { "data-gallery-images": "true" },
    createElement(
      "li",
      {
        "data-gallery-image": "true",
        "data-item-id": "a",
        "data-source": "INFOSPOT",
        "data-asset-id": "asset-1",
        "data-caption": "Un pie",
        "data-credit": "Foto: Y",
      },
      createElement("img", { src: "https://cdn.infospot.example/a.jpg", alt: "Foto A" }),
    ),
    createElement(
      "li",
      {
        "data-gallery-image": "true",
        "data-item-id": "b",
        "data-source": "CLF",
        "data-photo-id": "photo-1",
      },
      createElement("img", { src: "", alt: "Foto B" }),
    ),
  );

  const images = extractGalleryImagesFromChildren(tree);
  assert.equal(images.length, 2);
  assert.equal(images[0]!.id, "a");
  assert.equal(images[0]!.source, "INFOSPOT");
  assert.equal(images[0]!.assetId, "asset-1");
  assert.equal(images[0]!.previewUrl, "https://cdn.infospot.example/a.jpg");
  assert.equal(images[0]!.alt, "Foto A");
  assert.equal(images[0]!.caption, "Un pie");
  assert.equal(images[1]!.id, "b");
  assert.equal(images[1]!.source, "CLF");
  assert.equal(images[1]!.photoId, "photo-1");
}

// --- 4. extractGalleryImagesFromChildren ignora <li> sin marcador de galería (lista Markdown normal) ---
{
  const tree = createElement(
    "ol",
    {},
    createElement("li", {}, "Un ítem de lista común, no una galería"),
  );
  const images = extractGalleryImagesFromChildren(tree);
  assert.equal(images.length, 0);
}

// --- 5. resolveGalleryForRender: menos de 2 imágenes → null (falla segura) ---
{
  const result = resolveGalleryForRender(
    { id: "g1", title: null, caption: null, autoplay: true, intervalMs: 5000, loop: true },
    [
      {
        id: "a",
        source: "INFOSPOT",
        assetId: "asset-1",
        photoId: null,
        previewUrl: "https://cdn.infospot.example/a.jpg",
        alt: "A",
        caption: null,
        credit: null,
        photographerName: null,
        photographerProfileUrl: null,
        purchaseUrl: null,
      },
    ],
    undefined,
  );
  assert.equal(result, null);
}

// --- 6. resolveGalleryForRender: CLF revocada/removida → src null, pero la otra imagen sobrevive ---
{
  const photoById: Record<string, PublicEditorialPhotoViewModel> = {
    "photo-ok": mockPhoto({ id: "photo-ok" }),
    "photo-revoked": mockPhoto({ id: "photo-revoked", revoked: true, src: null }),
  };
  const result = resolveGalleryForRender(
    { id: "g1", title: "T", caption: null, autoplay: true, intervalMs: 5000, loop: true },
    [
      {
        id: "a",
        source: "CLF",
        assetId: null,
        photoId: "photo-ok",
        previewUrl: "",
        alt: "",
        caption: null,
        credit: null,
        photographerName: null,
        photographerProfileUrl: null,
        purchaseUrl: null,
      },
      {
        id: "b",
        source: "CLF",
        assetId: null,
        photoId: "photo-revoked",
        previewUrl: "",
        alt: "B",
        caption: null,
        credit: null,
        photographerName: null,
        photographerProfileUrl: null,
        purchaseUrl: null,
      },
      {
        id: "c",
        source: "INFOSPOT",
        assetId: "asset-1",
        photoId: null,
        previewUrl: "https://cdn.infospot.example/c.jpg",
        alt: "C",
        caption: null,
        credit: "Foto: Z",
        photographerName: null,
        photographerProfileUrl: null,
        purchaseUrl: null,
      },
    ],
    photoById,
  );
  assert.ok(result, "3 imágenes con 2 disponibles debe alcanzar para mostrar la galería");
  assert.equal(result!.images.length, 3, "la foto revocada se mantiene como slide (para placeholder), no se descarta");
  assert.equal(result!.images[0]!.src, "https://cdn.compramelafoto.example/derivado.jpg");
  assert.equal(result!.images[0]!.alt, "Foto CLF", "usa el alt de photoById si el bloque no trae uno propio");
  assert.equal(result!.images[1]!.src, null, "revocada → sin src");
  assert.equal(result!.images[2]!.src, "https://cdn.infospot.example/c.jpg");
}

// --- 7. resolveGalleryForRender: casi todo revocado → null (no vale la pena mostrar el bloque) ---
{
  const photoById: Record<string, PublicEditorialPhotoViewModel> = {
    "photo-revoked-1": mockPhoto({ id: "photo-revoked-1", revoked: true, src: null }),
    "photo-revoked-2": mockPhoto({ id: "photo-revoked-2", revoked: true, src: null }),
  };
  const result = resolveGalleryForRender(
    { id: "g1", title: null, caption: null, autoplay: true, intervalMs: 5000, loop: true },
    [
      {
        id: "a",
        source: "CLF",
        assetId: null,
        photoId: "photo-revoked-1",
        previewUrl: "",
        alt: "",
        caption: null,
        credit: null,
        photographerName: null,
        photographerProfileUrl: null,
        purchaseUrl: null,
      },
      {
        id: "b",
        source: "CLF",
        assetId: null,
        photoId: "photo-revoked-2",
        previewUrl: "",
        alt: "",
        caption: null,
        credit: null,
        photographerName: null,
        photographerProfileUrl: null,
        purchaseUrl: null,
      },
    ],
    photoById,
  );
  assert.equal(result, null);
}

// --- 8. resolveGalleryForRender: purchaseUrl/photographerProfileUrl inseguros se filtran (nunca llegan a href) ---
{
  const result = resolveGalleryForRender(
    { id: "g1", title: null, caption: null, autoplay: true, intervalMs: 5000, loop: true },
    [
      {
        id: "a",
        source: "INFOSPOT",
        assetId: "asset-1",
        photoId: null,
        previewUrl: "https://cdn.infospot.example/a.jpg",
        alt: "A",
        caption: null,
        credit: "Foto: A",
        photographerName: null,
        photographerProfileUrl: "javascript:alert(1)",
        purchaseUrl: "javascript:alert(2)",
      },
      {
        id: "b",
        source: "INFOSPOT",
        assetId: "asset-2",
        photoId: null,
        previewUrl: "https://cdn.infospot.example/b.jpg",
        alt: "B",
        caption: null,
        credit: "Foto: B",
        photographerName: null,
        photographerProfileUrl: null,
        purchaseUrl: null,
      },
    ],
    undefined,
  );
  assert.ok(result);
  assert.equal(result!.images[0]!.purchaseHref, null);
  assert.equal(result!.images[0]!.photographerProfileUrl, null);
}

// --- 9. resolveGalleryForRender: intervalMs se acota a un rango razonable ---
{
  const base = {
    id: "a",
    assetId: "asset-1",
    photoId: null,
    previewUrl: "https://cdn.infospot.example/a.jpg",
    alt: "A",
    caption: null,
    credit: "Foto: A",
    photographerName: null,
    photographerProfileUrl: null,
    purchaseUrl: null,
  };
  const tooLow = resolveGalleryForRender(
    { id: "g1", title: null, caption: null, autoplay: true, intervalMs: 100, loop: true },
    [
      { ...base, id: "a", source: "INFOSPOT" as const },
      { ...base, id: "b", source: "INFOSPOT" as const, assetId: "asset-2" },
    ],
    undefined,
  );
  assert.ok(tooLow);
  assert.ok(tooLow!.intervalMs >= 2000);

  const tooHigh = resolveGalleryForRender(
    { id: "g1", title: null, caption: null, autoplay: true, intervalMs: 999999, loop: true },
    [
      { ...base, id: "a", source: "INFOSPOT" as const },
      { ...base, id: "b", source: "INFOSPOT" as const, assetId: "asset-2" },
    ],
    undefined,
  );
  assert.ok(tooHigh);
  assert.ok(tooHigh!.intervalMs <= 20000);
}

// --- 10. Nunca se sirve el original: una foto CLF siempre resuelve por
// photoById, sin importar qué previewUrl venga persistido en el bloque
// (protege contra contenido viejo/manipulado con una URL falsa embebida). ---
{
  const photoById: Record<string, PublicEditorialPhotoViewModel> = {
    "photo-1": mockPhoto({ id: "photo-1", src: "https://cdn.compramelafoto.example/derivado-real.jpg" }),
  };
  const result = resolveGalleryForRender(
    { id: "g1", title: null, caption: null, autoplay: true, intervalMs: 5000, loop: true },
    [
      {
        id: "a",
        source: "CLF",
        assetId: null,
        photoId: "photo-1",
        // previewUrl sospechoso persistido en HTML viejo/manipulado — nunca debe usarse.
        previewUrl: "https://storage.internal.example/clf/originals/secret-original.jpg",
        alt: "",
        caption: null,
        credit: null,
        photographerName: null,
        photographerProfileUrl: null,
        purchaseUrl: null,
      },
      {
        id: "b",
        source: "INFOSPOT",
        assetId: "asset-1",
        photoId: null,
        previewUrl: "https://cdn.infospot.example/b.jpg",
        alt: "B",
        caption: null,
        credit: "Foto: B",
        photographerName: null,
        photographerProfileUrl: null,
        purchaseUrl: null,
      },
    ],
    photoById,
  );
  assert.ok(result);
  assert.equal(
    result!.images[0]!.src,
    "https://cdn.compramelafoto.example/derivado-real.jpg",
    "el src de una foto CLF debe venir siempre de photoById",
  );
  assert.notEqual(
    result!.images[0]!.src,
    "https://storage.internal.example/clf/originals/secret-original.jpg",
    "el previewUrl persistido en el bloque nunca debe filtrarse como src para fotos CLF",
  );
}

console.log("editorial-gallery-render.test.ts: OK");
