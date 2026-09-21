/**
 * Las claves del portfolio siguen el mismo patrón que las del avatar: el hash
 * del contenido va EN la clave, así la ruta se puede cachear para siempre.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPortfolioKey,
  parsePortfolioKey,
  extensionForPortfolioMime,
  contentTypeForPortfolioExtension,
  PORTFOLIO_MAX_IMAGENES,
  PORTFOLIO_MAX_BYTES,
} from "./portfolioKeys";

test("la clave separa el portfolio del avatar", () => {
  assert.equal(
    buildPortfolioKey("cuenta1", "abc123", "jpg"),
    "fotorank/judges/cuenta1/portfolio/abc123.jpg",
  );
});

test("la clave se puede volver a leer", () => {
  assert.deepEqual(parsePortfolioKey("fotorank/judges/cuenta1/portfolio/abc123.webp"), {
    judgeAccountId: "cuenta1",
    hash: "abc123",
    ext: "webp",
  });
});

test("una clave de avatar NO se acepta como portfolio", () => {
  assert.equal(parsePortfolioKey("fotorank/judges/cuenta1/avatar/abc123.jpg"), null);
});

test("una clave ajena no se interpreta", () => {
  assert.equal(parsePortfolioKey("fotorank/contests/x/entries/y/original"), null);
  assert.equal(parsePortfolioKey("../../etc/passwd"), null);
  assert.equal(parsePortfolioKey(""), null);
});

test("sólo se aceptan los tres formatos de imagen", () => {
  assert.equal(extensionForPortfolioMime("image/jpeg"), "jpg");
  assert.equal(extensionForPortfolioMime("image/png"), "png");
  assert.equal(extensionForPortfolioMime("image/webp"), "webp");
  assert.equal(extensionForPortfolioMime("image/gif"), null);
  assert.equal(extensionForPortfolioMime("application/pdf"), null);
});

test("cada extensión declara su tipo de contenido", () => {
  assert.equal(contentTypeForPortfolioExtension("jpg"), "image/jpeg");
  assert.equal(contentTypeForPortfolioExtension("png"), "image/png");
  assert.equal(contentTypeForPortfolioExtension("webp"), "image/webp");
});

test("los topes son los que dice el diseño", () => {
  assert.equal(PORTFOLIO_MAX_IMAGENES, 12);
  assert.equal(PORTFOLIO_MAX_BYTES, 4 * 1024 * 1024);
});
