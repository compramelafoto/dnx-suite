/**
 * Única forma de armar la ruta de una imagen de portfolio. Si cada pantalla la
 * armara por su cuenta, una quedaría sin el hash y se pegaría la imagen vieja.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { portfolioImageSrc } from "./portfolioSrc";

test("arma la ruta con el id y el hash", () => {
  assert.equal(
    portfolioImageSrc({
      id: "img1",
      contentHash: "abc123",
      storageKey: "fotorank/judges/c1/portfolio/abc123.jpg",
    }),
    "/api/jurados/portfolio/img1/abc123.jpg",
  );
});

test("respeta la extensión de la clave", () => {
  assert.equal(
    portfolioImageSrc({
      id: "img2",
      contentHash: "def456",
      storageKey: "fotorank/judges/c1/portfolio/def456.webp",
    }),
    "/api/jurados/portfolio/img2/def456.webp",
  );
});

test("una clave de avatar no se sirve como portfolio", () => {
  assert.equal(
    portfolioImageSrc({
      id: "img1",
      contentHash: "abc123",
      storageKey: "fotorank/judges/c1/avatar/abc123.jpg",
    }),
    null,
  );
});

test("sin clave no hay ruta", () => {
  assert.equal(portfolioImageSrc({ id: "img1", contentHash: "abc", storageKey: "" }), null);
  assert.equal(portfolioImageSrc({ id: "img1", contentHash: "abc", storageKey: "  " }), null);
});
