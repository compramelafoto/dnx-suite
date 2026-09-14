import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { editorADocumento, type EditorBlock } from "../design-studio-bridge";

/**
 * El bloque de foto no siempre se llama `photo`.
 *
 * En FotoOffice la foto del socio es la variable `photo` y el diseño no declara ninguna. En
 * Clickatón el catálogo la llama `participant.photoUrl`. Si el puente impone el nombre de
 * FotoOffice, la placa sale sin la cara del participante.
 */
function photoBlock(configJson: Record<string, unknown>): EditorBlock {
  return {
    id: "b-foto",
    type: "PHOTO",
    name: "Foto",
    pageIndex: 0,
    x: 100,
    y: 100,
    width: 300,
    height: 300,
    rotation: 0,
    zIndex: 0,
    opacity: 1,
    locked: false,
    visible: true,
    configJson,
  };
}

function primeraImagen(blocks: readonly EditorBlock[]) {
  const { document } = editorADocumento({
    canvas: { width: 1080, height: 1920 },
    blocks,
  });
  const sides = (document as { sides: { blocks: Record<string, unknown>[] }[] }).sides;
  return sides[0]?.blocks.find((b) => b.type === "image");
}

describe("editorADocumento — variable del bloque de foto", () => {
  it("respeta la variable que declara el diseño en source.variableKey", () => {
    const imagen = primeraImagen([
      photoBlock({ fit: "cover", source: { variableKey: "participant.photoUrl" } }),
    ]);

    assert.equal(imagen?.variableKey, "participant.photoUrl");
  });

  it("usa `photo` cuando el diseño no declara ninguna", () => {
    const imagen = primeraImagen([photoBlock({ fit: "cover" })]);

    assert.equal(imagen?.variableKey, "photo");
  });
});

/**
 * Una imagen no siempre se recorta para llenar su recuadro. Un logo tiene que entrar entero:
 * si se lo trata como una foto, sale recortado o deformado.
 */
describe("editorADocumento — encaje de las imágenes", () => {
  function imageBlock(configJson: Record<string, unknown>): EditorBlock {
    return { ...photoBlock(configJson), id: "b-img", type: "IMAGE" };
  }

  it("respeta el encaje «contain» que pide el diseño", () => {
    const imagen = primeraImagen([
      imageBlock({ fit: "contain", source: { variableKey: "branding.logoUrl" } }),
    ]);

    assert.equal(imagen?.fit, "contain");
  });

  it("usa «cover» cuando el diseño no pide otra cosa", () => {
    const imagen = primeraImagen([imageBlock({ source: { variableKey: "branding.logoUrl" } })]);

    assert.equal(imagen?.fit, "cover");
  });

  it("la foto de la persona sigue llenando su recuadro", () => {
    const imagen = primeraImagen([photoBlock({ source: { variableKey: "participant.photoUrl" } })]);

    assert.equal(imagen?.fit, "cover");
  });
});

/**
 * La tipografía de Clickatón. Si no está en el catálogo de impresión, el puente la sustituye
 * en silencio y la placa sale con otra letra que la que se ve en el Designer.
 */
describe("editorADocumento — tipografía de Clickatón", () => {
  it("no sustituye Barlow Condensed por otra familia", () => {
    const { document, avisos } = editorADocumento({
      canvas: { width: 1080, height: 1920 },
      blocks: [
        {
          ...photoBlock({ content: "Hola", fontFamily: "Barlow Condensed", fontSize: 40 }),
          type: "TEXT",
        },
      ],
    });

    const sides = (document as { sides: { blocks: Record<string, unknown>[] }[] }).sides;
    const texto = sides[0]?.blocks.find((b) => b.type === "text");
    assert.equal(texto?.fontId, "barlowCondensed");
    assert.deepEqual(avisos, []);
  });
});
