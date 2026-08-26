import { test } from "node:test";
import assert from "node:assert/strict";
import { FONT_CATALOG, FONT_IDS, isFontId, slotFor } from "./catalog";
import fontkit from "@pdf-lib/fontkit";
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

/**
 * Los caracteres que una institución argentina va a escribir sin pensarlo. Si a una fuente
 * del catálogo le falta uno, el carnet sale con un cuadradito y nadie se entera hasta que
 * está impreso.
 */
const CASTELLANO = "áéíóúüñÁÉÍÓÚÜÑ¿¡°ºª";

test("cada tipografia del catalogo tiene los glifos del castellano", async () => {
  for (const id of FONT_IDS) {
    for (const slot of ["normal", "bold", "italic", "boldItalic"] as const) {
      const fuente = fontkit.create(Buffer.from(await readFontBytes(id, slot)));
      for (const caracter of CASTELLANO) {
        const punto = caracter.codePointAt(0);
        if (punto === undefined) continue;
        // El glifo 0 es `.notdef`: el cuadradito. No alcanza con medir el ancho, porque
        // `.notdef` tiene ancho propio y una comprobación de "ancho mayor que cero" pasaría
        // igual.
        const glifo = fuente.glyphForCodePoint(punto);
        assert.notEqual(
          glifo.id,
          0,
          `${id} (${slot}) no tiene glifo para "${caracter}" (U+${punto.toString(16).toUpperCase()})`,
        );
      }
    }
  }
});

test("un caracter fuera del subconjunto latino cae en .notdef, como se espera", () => {
  // Verifica que la comprobación de arriba realmente distingue: si `glyphForCodePoint`
  // devolviera algo distinto de 0 para cualquier cosa, aquella prueba no probaría nada.
  return readFontBytes("dmSans", "normal").then((bytes) => {
    const fuente = fontkit.create(Buffer.from(bytes));
    assert.equal(fuente.glyphForCodePoint(0x6f22).id, 0, "esperaba .notdef para un ideograma");
  });
});
