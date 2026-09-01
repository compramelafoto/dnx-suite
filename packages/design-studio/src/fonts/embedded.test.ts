import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { FONT_CATALOG, FONT_IDS, type FontSlot } from "./catalog";
import { readFontBytes } from "./load";

const SLOTS: FontSlot[] = ["normal", "bold", "italic", "boldItalic"];

test("todas las variantes del catálogo se pueden leer", async () => {
  for (const id of FONT_IDS) {
    for (const slot of SLOTS) {
      const bytes = await readFontBytes(id, slot);
      assert.ok(bytes.length > 1000, `${id}:${slot} salió vacía o truncada`);
      // Cabecera WOFF: si esto falla, lo incrustado no es una tipografía.
      assert.equal(
        String.fromCharCode(...bytes.slice(0, 4)),
        "wOFF",
        `${id}:${slot} no parece un archivo WOFF`,
      );
    }
  }
});

test("lo incrustado coincide con lo instalado", async () => {
  /*
   * El riesgo de incrustar es que quede viejo: alguien actualiza @fontsource y el paquete sigue
   * dibujando con la versión anterior sin que nadie lo note. Esta prueba compara byte a byte y
   * falla cuando hay que regenerar con `pnpm --filter @repo/design-studio fuentes`.
   */
  const require = createRequire(import.meta.url);
  for (const id of FONT_IDS) {
    const def = FONT_CATALOG[id];
    for (const slot of SLOTS) {
      const enDisco = new Uint8Array(
        await readFile(require.resolve(`${def.pkg}/files/${def.files[slot]}`)),
      );
      const incrustada = await readFontBytes(id, slot);
      assert.deepEqual(
        Array.from(incrustada.slice(0, 64)),
        Array.from(enDisco.slice(0, 64)),
        `${id}:${slot} difiere de la instalada — regenerá las tipografías incrustadas`,
      );
      assert.equal(incrustada.length, enDisco.length, `${id}:${slot} cambió de tamaño`);
    }
  }
});

test("una tipografía que no está en el catálogo se rechaza", async () => {
  await assert.rejects(
    () => readFontBytes("comicSans" as never, "normal"),
    /no está en el catálogo/,
  );
});
