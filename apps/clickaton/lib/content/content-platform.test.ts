import assert from "node:assert/strict";
import test from "node:test";
import {
  CLICKATON_CONTENT_PLATFORM,
  CONTENT_PLATFORMS,
  clickatonPlatformWhere,
  isContentPlatform,
  stripClientPlatform,
} from "./content-platform";

test("la plataforma de Clickatón es 'clickaton'", () => {
  assert.equal(CLICKATON_CONTENT_PLATFORM, "clickaton");
  assert.ok(isContentPlatform(CLICKATON_CONTENT_PLATFORM));
  assert.ok(CONTENT_PLATFORMS.includes(CLICKATON_CONTENT_PLATFORM));
});

test("clickatonPlatformWhere fija el scope de la plataforma", () => {
  assert.deepEqual(clickatonPlatformWhere, { platform: "clickaton" });
});

test("clickatonPlatformWhere nunca coincide con otra plataforma", () => {
  assert.notEqual(clickatonPlatformWhere.platform, "compramelafoto");
  assert.notEqual(clickatonPlatformWhere.platform, "fotorank");
});

test("stripClientPlatform descarta la plataforma enviada por el cliente", () => {
  const payload = {
    title: "Nota",
    platform: "compramelafoto",
    slug: "nota",
  };
  const cleaned = stripClientPlatform(payload);

  assert.equal("platform" in cleaned, false);
  assert.equal(cleaned.title, "Nota");
  assert.equal(cleaned.slug, "nota");
});

test("stripClientPlatform tolera payloads sin plataforma", () => {
  assert.deepEqual(stripClientPlatform({ title: "Nota" }), { title: "Nota" });
});
