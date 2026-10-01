import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildBenefitListHeadline,
  buildBenefitPublicShortLine,
} from "./benefit-copy";

/**
 * El nombre del producto del fotógrafo tiene que aparecer también cuando el
 * beneficio pide varias fotos (un librito con individual + grupal, por ejemplo).
 * Antes sólo se usaba en la rama de una sola foto y el resto quedaba como
 * "1 impresión (2 fotos c/u)", sin decir qué producto era.
 */

test("catálogo público: impreso de una foto muestra el nombre del producto", () => {
  const line = buildBenefitPublicShortLine({
    kind: "PHYSICAL",
    includedQuantity: 1,
    selectionMode: "SINGLE_PHOTO",
    requiredPhotoCount: 1,
    photographerProductName: "Copia individual",
  });
  assert.equal(line, "1× Copia individual");
});

test("catálogo público: impreso de varias fotos muestra el nombre del producto", () => {
  const line = buildBenefitPublicShortLine({
    kind: "PHYSICAL",
    includedQuantity: 1,
    selectionMode: "MULTI_PHOTO_FIXED",
    requiredPhotoCount: 2,
    photographerProductName: "Librito 5º año (individual + grupal)",
  });
  assert.equal(line, "1× Librito 5º año (individual + grupal) (2 fotos)");
});

test("catálogo público: sin producto vinculado, se mantiene el texto genérico", () => {
  const line = buildBenefitPublicShortLine({
    kind: "PHYSICAL",
    includedQuantity: 1,
    selectionMode: "MULTI_PHOTO_FIXED",
    requiredPhotoCount: 2,
    photographerProductName: null,
  });
  assert.equal(line, "1 impresión (2 fotos c/u)");
});

test("catálogo público: los digitales no cambian", () => {
  assert.equal(
    buildBenefitPublicShortLine({
      kind: "DIGITAL",
      includedQuantity: 2,
      selectionMode: "MULTI_PHOTO_FIXED",
      requiredPhotoCount: 3,
      photographerProductName: "No corresponde",
    }),
    "2 descargas (3 fotos c/u)"
  );
});

test("listado: impreso de varias fotos muestra el nombre del producto", () => {
  const line = buildBenefitListHeadline({
    kind: "PHYSICAL",
    includedQuantity: 1,
    selectionMode: "MULTI_PHOTO_FIXED",
    requiredPhotoCount: 2,
    photographerProductName: "Librito 5º año (individual + grupal)",
  });
  assert.equal(line, "1× Librito 5º año (individual + grupal) · 2 fotos c/u");
});

test("listado: la cantidad no se pierde cuando el pack trae más de uno", () => {
  const line = buildBenefitListHeadline({
    kind: "PHYSICAL",
    includedQuantity: 2,
    selectionMode: "MULTI_PHOTO_FIXED",
    requiredPhotoCount: 2,
    photographerProductName: "Librito grupal",
  });
  assert.equal(line, "2× Librito grupal · 2 fotos c/u");
});

test("listado: impreso de una foto muestra el nombre del producto", () => {
  const line = buildBenefitListHeadline({
    kind: "PHYSICAL",
    includedQuantity: 1,
    selectionMode: "SINGLE_PHOTO",
    requiredPhotoCount: 1,
    photographerProductName: "Copia grupal",
  });
  assert.equal(line, "1× Copia grupal");
});

test("listado: sin producto vinculado, se mantiene el texto genérico", () => {
  assert.equal(
    buildBenefitListHeadline({
      kind: "PHYSICAL",
      includedQuantity: 1,
      selectionMode: "MULTI_PHOTO_FIXED",
      requiredPhotoCount: 2,
    }),
    "1 impresión · 2 fotos c/u"
  );
  assert.equal(
    buildBenefitListHeadline({
      kind: "PHYSICAL",
      includedQuantity: 2,
      selectionMode: "SINGLE_PHOTO",
      requiredPhotoCount: 1,
    }),
    "2 impresos"
  );
});
