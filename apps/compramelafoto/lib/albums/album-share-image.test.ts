import assert from "node:assert/strict";
import { test } from "node:test";

process.env.R2_PUBLIC_URL = "https://pub-ejemplo.r2.dev";

import { resolveSchoolShareImageUrl } from "./album-share-image";

const SITE = "https://www.compramelafoto.com";

test("un logo ya público se usa tal cual", () => {
  assert.equal(
    resolveSchoolShareImageUrl("https://pub-ejemplo.r2.dev/school-logos/534/goethe.png", SITE),
    "https://pub-ejemplo.r2.dev/school-logos/534/goethe.png"
  );
});

test("una key de R2 se convierte en URL absoluta", () => {
  assert.equal(
    resolveSchoolShareImageUrl("school-logos/534/goethe.png", SITE),
    "https://pub-ejemplo.r2.dev/school-logos/534/goethe.png"
  );
});

test("una key con barra inicial también funciona", () => {
  assert.equal(
    resolveSchoolShareImageUrl("/school-logos/534/goethe.png", SITE),
    "https://pub-ejemplo.r2.dev/school-logos/534/goethe.png"
  );
});

test("sin logo devuelve null para que el llamador use su fallback", () => {
  assert.equal(resolveSchoolShareImageUrl(null, SITE), null);
  assert.equal(resolveSchoolShareImageUrl(undefined, SITE), null);
  assert.equal(resolveSchoolShareImageUrl("   ", SITE), null);
});
