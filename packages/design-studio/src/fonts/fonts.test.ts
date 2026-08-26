import { test } from "node:test";
import assert from "node:assert/strict";
import { FONT_CATALOG, FONT_IDS, isFontId, slotFor } from "./catalog";
import { readFontBytes } from "./load";

test("el catalogo declara los cuatro archivos de cada fuente", () => {
  for (const id of FONT_IDS) {
    const def = FONT_CATALOG[id];
    assert.ok(def, `falta la definición de ${id}`);
    for (const slot of ["normal", "bold", "italic", "boldItalic"] as const) {
      assert.ok(def.files[slot].endsWith(".woff"), `${id}.${slot} no apunta a un .woff`);
    }
    assert.ok(def.fallbackStack.length > 0, `${id} no declara alternativa`);
  }
});

test("reconoce un identificador del catalogo y rechaza uno de afuera", () => {
  assert.equal(isFontId("dmSans"), true);
  assert.equal(isFontId("comicSans"), false);
  assert.equal(isFontId(42), false);
});

test("elige la variante segun peso y estilo", () => {
  assert.equal(slotFor("normal", "normal"), "normal");
  assert.equal(slotFor("bold", "normal"), "bold");
  assert.equal(slotFor("normal", "italic"), "italic");
  assert.equal(slotFor("bold", "italic"), "boldItalic");
});

test("lee los bytes reales de cada archivo del catalogo", async () => {
  for (const id of FONT_IDS) {
    const bytes = await readFontBytes(id, "normal");
    assert.ok(bytes.byteLength > 1000, `${id} devolvió ${bytes.byteLength} bytes`);
    // Cabecera de un archivo WOFF: los cuatro primeros bytes son "wOFF".
    assert.equal(String.fromCharCode(...bytes.slice(0, 4)), "wOFF", `${id} no parece un WOFF`);
  }
});

test("una fuente fuera del catalogo falla con un mensaje entendible", async () => {
  await assert.rejects(() => readFontBytes("comicSans" as never, "normal"), /comicSans/);
});
