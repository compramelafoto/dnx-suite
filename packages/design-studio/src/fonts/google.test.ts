import { test } from "node:test";
import assert from "node:assert/strict";
import { fontDefinition, isFontId, isGoogleFontId } from "./catalog";
import { fontsourceUrl } from "./load";

test("acepta familias de Google por nombre y nada que tuerza la URL", () => {
  assert.ok(isFontId("google:Montserrat"));
  assert.ok(isFontId("google:Source Serif 4"));
  assert.ok(!isGoogleFontId("google:"));
  assert.ok(!isGoogleFontId("google:Lato&family=Otra"));
  assert.ok(!isGoogleFontId("google:../../x"));
  assert.ok(!isFontId("comicSans"));
});

test("la definición de una familia de Google usa su nombre", () => {
  assert.equal(fontDefinition("google:Lato").cssFamily, "Lato");
  assert.equal(fontDefinition("dmSans").label, "DM Sans");
});

test("pide la variante justa a Fontsource", () => {
  assert.equal(
    fontsourceUrl("Source Serif 4", "boldItalic"),
    "https://cdn.jsdelivr.net/fontsource/fonts/source-serif-4@latest/latin-700-italic.ttf",
  );
  assert.equal(
    fontsourceUrl("Great Vibes", "normal"),
    "https://cdn.jsdelivr.net/fontsource/fonts/great-vibes@latest/latin-400-normal.ttf",
  );
});
