import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFontBytes, type FontId } from "@repo/design-studio";
import { editorADocumento, type EditorBlock } from "../design-studio-bridge";
import { EDITOR_FONT_CATALOG } from "../editor-font-catalog";

/**
 * Toda tipografía que el editor ofrece se imprime con esa misma tipografía.
 *
 * El editor ofrece unas sesenta familias y el PDF incrustaba siete: el resto —Helvetica,
 * Montserrat, Lato…— se cambiaba en silencio por DM Sans y el archivo salía con otra letra que
 * la pantalla (la carpeta de San Patricio). Si alguien suma una familia al editor que el PDF no
 * sabe imprimir, esta prueba lo frena.
 */
function texto(fontFamily: string): EditorBlock {
  return {
    id: "t",
    type: "TEXT",
    name: null,
    pageIndex: 0,
    x: 0,
    y: 0,
    width: 500,
    height: 100,
    rotation: 0,
    zIndex: 0,
    opacity: 1,
    locked: false,
    visible: true,
    configJson: { content: "Hola", fontFamily, fontSize: 40 },
  };
}

function fuenteImpresa(fontFamily: string): { fontId: FontId; avisos: string[] } {
  const r = editorADocumento({ canvas: { width: 1000, height: 1000 }, blocks: [texto(fontFamily)] });
  const sides = (r.document as { sides: { blocks: { fontId: FontId }[] }[] }).sides;
  return { fontId: sides[0]!.blocks[0]!.fontId, avisos: r.avisos };
}

describe("tipografías del editor en el PDF", () => {
  it("ninguna familia del editor se reemplaza por otra", () => {
    for (const f of EDITOR_FONT_CATALOG) {
      const { fontId, avisos } = fuenteImpresa(f.family);
      assert.deepEqual(avisos, [], `${f.family}: ${avisos.join(" | ")}`);
      if (f.family !== "DM Sans") assert.notEqual(fontId, "dmSans", `${f.family} se imprimía como DM Sans`);
    }
  });

  it("las del sistema usan su equivalente del mismo ancho", () => {
    assert.equal(fuenteImpresa("Helvetica").fontId, "google:Arimo");
    assert.equal(fuenteImpresa("Arial, sans-serif").fontId, "google:Arimo");
    assert.equal(fuenteImpresa("Times New Roman").fontId, "google:Tinos");
    assert.equal(fuenteImpresa("Georgia").fontId, "google:Gelasio");
  });

  it("las incrustadas siguen usando su archivo propio", () => {
    assert.equal(fuenteImpresa("Inter").fontId, "inter");
    assert.equal(fuenteImpresa("Playfair Display").fontId, "playfairDisplay");
  });

  it("una familia desconocida avisa, no falla", () => {
    const { fontId, avisos } = fuenteImpresa("Comic Sans MS");
    assert.equal(fontId, "dmSans");
    assert.equal(avisos.length, 1);
  });

  it(
    "cada tipografía del editor se puede bajar de verdad para incrustarla",
    { skip: process.env.SIN_RED === "1" ? "sin red" : false, timeout: 180_000 },
    async () => {
      const ids = new Set(EDITOR_FONT_CATALOG.map((f) => fuenteImpresa(f.family).fontId));
      const fallidas: string[] = [];
      await Promise.all(
        [...ids].map(async (id) => {
          for (const slot of ["normal", "bold"] as const) {
            try {
              const bytes = await readFontBytes(id, slot);
              if (bytes.length < 1000) fallidas.push(`${id} ${slot}: archivo vacío`);
            } catch (e) {
              fallidas.push(`${id} ${slot}: ${e instanceof Error ? e.message : String(e)}`);
            }
          }
        }),
      );
      assert.deepEqual(fallidas, []);
    },
  );
});
