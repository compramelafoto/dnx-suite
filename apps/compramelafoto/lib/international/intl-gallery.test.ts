import { test } from "node:test";
import assert from "node:assert/strict";
import { buildIntlGalleryPricing, parseIntlCheckoutPhotoIds } from "./intl-gallery";
import { buildGallerySelectionEstimate } from "@/lib/gallery/format-gallery-selection-estimate";
import { formatMoney } from "./money";

test("precio por foto para el cliente: precio + 15 %", () => {
  const p = buildIntlGalleryPricing(1000000, "COP");
  assert.equal(p.kind, "DIGITAL_UNIFORM");
  if (p.kind !== "DIGITAL_UNIFORM") return;
  assert.equal(p.digitalUnitPriceArs, 1150000);
  assert.equal(p.digitalUnitPriceLabel, formatMoney(1150000, "COP"));
  assert.equal(p.currency, "COP");
  assert.equal(p.digitalDiscount5Plus, null);
});
test("el total estimado de la galería sale en la moneda del álbum", () => {
  const est = buildGallerySelectionEstimate(buildIntlGalleryPricing(1000000, "COP"), 2);
  assert.equal(est?.totalArs, 2300000);
  assert.equal(est?.estimatedTotalLabel, `Total digital estimado: ${formatMoney(2300000, "COP")}`);
});
test("lista de fotos de la URL", () => {
  assert.deepEqual(parseIntlCheckoutPhotoIds("3, 5,x,5,0"), [3, 5]);
  assert.deepEqual(parseIntlCheckoutPhotoIds(null), []);
});
