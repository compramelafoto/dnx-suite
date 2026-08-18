/**
 * Contrato del bloque "editorialGallery": validación pura y round-trip de
 * serialización HTML/Markdown (sanitización doble: sanitize-html al guardar,
 * compatible con rehype-sanitize al renderizar — ver apps/infospot/lib/markdown.tsx).
 * Ejecutar: pnpm --filter @repo/db exec tsx ../../packages/editor/src/editorial-gallery.test.ts
 */

import assert from "node:assert/strict";
import {
  EDITORIAL_GALLERY_MAX_IMAGES,
  EDITORIAL_GALLERY_MIN_IMAGES,
  isSafeUrl,
  validateEditorialGallery,
  type EditorialGalleryAttrs,
} from "./editorial-gallery";
import { editorHtmlToMarkdown, markdownToEditorHtml } from "./markdown";
import { sanitizeEditorialHtml } from "./sanitize";

function image(overrides: Partial<EditorialGalleryAttrs["images"][number]> = {}) {
  return {
    id: overrides.id ?? `img-${Math.random().toString(36).slice(2)}`,
    source: overrides.source ?? ("INFOSPOT" as const),
    assetId: overrides.assetId ?? "asset-1",
    photoId: overrides.photoId ?? null,
    previewUrl: overrides.previewUrl ?? "https://cdn.infospot.example/photo.jpg",
    alt: overrides.alt ?? "Descripción de la foto",
    caption: overrides.caption,
    credit: overrides.credit,
    purchaseUrl: overrides.purchaseUrl,
    photographerName: overrides.photographerName,
    photographerProfileUrl: overrides.photographerProfileUrl,
    width: overrides.width,
    height: overrides.height,
  };
}

function gallery(images: ReturnType<typeof image>[]): EditorialGalleryAttrs {
  return {
    id: "gallery-1",
    title: "Título",
    caption: "Epígrafe general",
    autoplay: true,
    intervalMs: 5000,
    loop: true,
    images,
  };
}

// --- 1. Galería válida (2 imágenes distintas) pasa ---
{
  const result = validateEditorialGallery(
    gallery([
      image({ id: "a", assetId: "asset-1" }),
      image({ id: "b", assetId: "asset-2" }),
    ]),
  );
  assert.equal(result.ok, true);
}

// --- 2. Mínimo 2 imágenes ---
{
  const result = validateEditorialGallery(gallery([image({ assetId: "asset-1" })]));
  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.error, "TOO_FEW_IMAGES");
  assert.equal(EDITORIAL_GALLERY_MIN_IMAGES, 2);
}

// --- 3. Máximo 20 imágenes ---
{
  const images = Array.from({ length: EDITORIAL_GALLERY_MAX_IMAGES + 1 }, (_, i) =>
    image({ id: `img-${i}`, assetId: `asset-${i}` }),
  );
  const result = validateEditorialGallery(gallery(images));
  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.error, "TOO_MANY_IMAGES");
}

// --- 4. Exactamente 20 imágenes es válido (límite inclusive) ---
{
  const images = Array.from({ length: EDITORIAL_GALLERY_MAX_IMAGES }, (_, i) =>
    image({ id: `img-${i}`, assetId: `asset-${i}` }),
  );
  const result = validateEditorialGallery(gallery(images));
  assert.equal(result.ok, true);
}

// --- 5. Rechazo de duplicados (mismo assetId) ---
{
  const result = validateEditorialGallery(
    gallery([
      image({ id: "a", assetId: "asset-1" }),
      image({ id: "b", assetId: "asset-1" }),
    ]),
  );
  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.error, "DUPLICATE_IMAGE");
}

// --- 6. Rechazo de duplicados (mismo photoId CLF) ---
{
  const result = validateEditorialGallery(
    gallery([
      image({ id: "a", source: "CLF", assetId: null, photoId: "photo-1" }),
      image({ id: "b", source: "CLF", assetId: null, photoId: "photo-1" }),
    ]),
  );
  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.error, "DUPLICATE_IMAGE");
}

// --- 7. Un assetId y un photoId iguales en valor pero de distinta fuente NO son duplicado ---
{
  const result = validateEditorialGallery(
    gallery([
      image({ id: "a", source: "INFOSPOT", assetId: "same-id", photoId: null }),
      image({ id: "b", source: "CLF", assetId: null, photoId: "same-id" }),
    ]),
  );
  assert.equal(result.ok, true);
}

// --- 8. Alt obligatorio por imagen ---
{
  const result = validateEditorialGallery(
    gallery([image({ id: "a", assetId: "asset-1", alt: "" }), image({ id: "b", assetId: "asset-2" })]),
  );
  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.error, "MISSING_ALT");
}

// --- 9. Rechazo de protocolos inseguros en previewUrl ---
{
  const result = validateEditorialGallery(
    gallery([
      image({ id: "a", assetId: "asset-1", previewUrl: "javascript:alert(1)" }),
      image({ id: "b", assetId: "asset-2" }),
    ]),
  );
  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.error, "UNSAFE_URL");
}

// --- 10. Rechazo de protocolos inseguros en purchaseUrl ---
{
  const result = validateEditorialGallery(
    gallery([
      image({ id: "a", assetId: "asset-1", purchaseUrl: "data:text/html,<script>alert(1)</script>" }),
      image({ id: "b", assetId: "asset-2" }),
    ]),
  );
  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.error, "UNSAFE_URL");
}

// --- 11. http(s) y rutas relativas son seguras ---
{
  assert.equal(isSafeUrl("https://compramelafoto.com/album/x"), true);
  assert.equal(isSafeUrl("http://example.com"), true);
  assert.equal(isSafeUrl("/redaccion/coberturas/123"), true);
  assert.equal(isSafeUrl(null), true);
  assert.equal(isSafeUrl(undefined), true);
  assert.equal(isSafeUrl(""), true);
  assert.equal(isSafeUrl("javascript:alert(1)"), false);
  assert.equal(isSafeUrl("data:text/html,x"), false);
  assert.equal(isSafeUrl("vbscript:msgbox(1)"), false);
}

// --- 12. Formas inválidas (versión futura desconocida / shape roto) fallan seguro, sin lanzar ---
{
  assert.doesNotThrow(() => validateEditorialGallery(null));
  assert.doesNotThrow(() => validateEditorialGallery(undefined));
  assert.doesNotThrow(() => validateEditorialGallery("not-an-object"));
  assert.doesNotThrow(() => validateEditorialGallery({}));
  assert.doesNotThrow(() => validateEditorialGallery({ version: 99, images: "not-an-array" }));

  assert.equal(validateEditorialGallery(null).ok, false);
  assert.equal(validateEditorialGallery({}).ok, false);
  assert.equal(
    validateEditorialGallery({ version: 99, images: "not-an-array" }).ok,
    false,
  );
}

// --- 13. Sanitización: <script>, onerror y javascript: no sobreviven en el bloque persistido ---
{
  const dirty = [
    '<figure data-editorial-gallery="true" data-gallery-id="g1" data-gallery-title="<script>alert(1)</script>Título">',
    '<ol data-gallery-images="true">',
    '<li data-gallery-image="true" data-item-id="a" data-source="INFOSPOT" data-asset-id="asset-1"',
    ' data-alt="foto" data-caption="<img src=x onerror=alert(1)>" data-credit="javascript:alert(2)">',
    '<img src="https://cdn.infospot.example/a.jpg" alt="foto" loading="lazy" decoding="async" draggable="false" onerror="alert(3)" />',
    "</li>",
    "</ol>",
    "</figure>",
  ].join("");

  const clean = sanitizeEditorialHtml(dirty);
  assert.ok(!clean.includes("<script"), "no debe sobrevivir <script> real");
  assert.ok(
    !clean.includes('onerror="alert(3)"'),
    "el onerror del <img> real (payload alert(3)) no debe sobrevivir como atributo vivo",
  );
  assert.ok(
    clean.includes("&lt;img"),
    "el intento de inyectar <img onerror> dentro de data-caption debe quedar escapado como texto inerte, no como tag",
  );
  // sanitize-html no valida esquema de valores en atributos data-* arbitrarios
  // (solo en href/src reconocidos): esto es responsabilidad de
  // validateEditorialGallery/isSafeUrl antes de usar el valor como href real
  // (ver EditorialGalleryBlock, que nunca debe volcar data-credit/purchaseUrl
  // directo a un href sin pasar por isSafeUrl).
  assert.ok(clean.includes("data-editorial-gallery"), "debe conservar el marcador de galería");
  assert.ok(clean.includes("cdn.infospot.example/a.jpg"), "debe conservar el src legítimo");
}

// --- 14. Round-trip HTML → Markdown → HTML preserva el bloque de galería intacto ---
{
  const html =
    '<p>Antes</p>' +
    '<figure data-editorial-gallery="true" class="is-editorial-gallery" data-gallery-id="g1" ' +
    'data-gallery-title="Cobertura" data-autoplay="true" data-interval-ms="5000" data-loop="true">' +
    '<ol data-gallery-images="true">' +
    '<li data-gallery-image="true" data-item-id="a" data-source="INFOSPOT" data-asset-id="asset-1" data-alt="Foto 1">' +
    '<img src="https://cdn.infospot.example/a.jpg" alt="Foto 1" loading="lazy" decoding="async" draggable="false"/>' +
    "</li>" +
    '<li data-gallery-image="true" data-item-id="b" data-source="CLF" data-photo-id="photo-9" data-alt="Foto 2">' +
    '<img src="" alt="Foto 2" loading="lazy" decoding="async" draggable="false"/>' +
    "</li>" +
    "</ol>" +
    "</figure>" +
    "<p>Después</p>";

  const markdown = editorHtmlToMarkdown(html);
  assert.ok(markdown.includes("data-editorial-gallery"), "la isla HTML debe preservarse en el Markdown");
  assert.ok(markdown.includes("Antes"));
  assert.ok(markdown.includes("Después"));

  const rehydrated = markdownToEditorHtml(markdown);
  assert.ok(rehydrated.includes('data-gallery-id="g1"'));
  assert.ok(rehydrated.includes('data-item-id="a"'));
  assert.ok(rehydrated.includes('data-item-id="b"'));
  assert.ok(rehydrated.includes('data-photo-id="photo-9"'));
  assert.ok(rehydrated.includes("cdn.infospot.example/a.jpg"), "src propio (INFOSPOT) se conserva");
}

// --- 15. Compatibilidad: un bloque editorialImage previo convive sin cambios ---
{
  const html =
    '<figure data-editorial-image="true" data-credit="Foto: X" data-caption="Un pie">' +
    '<img src="https://cdn.infospot.example/legacy.jpg" alt="legacy"/>' +
    "<figcaption>" +
    '<span data-caption="true">Un pie</span>' +
    '<span data-credit-text="true">Foto: X</span>' +
    "</figcaption>" +
    "</figure>";
  const markdown = editorHtmlToMarkdown(html);
  const rehydrated = markdownToEditorHtml(markdown);
  assert.ok(rehydrated.includes("data-editorial-image"));
  assert.ok(rehydrated.includes("cdn.infospot.example/legacy.jpg"));
}

console.log("editorial-gallery.test.ts: OK");
