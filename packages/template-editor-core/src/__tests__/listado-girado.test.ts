import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { editorADocumento, type EditorBlock } from "../design-studio-bridge";

/**
 * El listado del curso gira con su bloque.
 *
 * La carpeta de San Patricio lleva el listado a 90°. El puente lo repartía en celdas derechas y
 * sin giro: el PDF lo mostraba acostado, encimado con el curso y fuera de su lugar.
 */
const nombres = ["Sofía", "Mateo", "Valentina", "Benjamín", "Isabella", "Thiago", "Emma", "Joaquín"];

function listado(rotation: number): EditorBlock {
  return {
    id: "lista",
    type: "VARIABLE_TEXT",
    name: "Listado",
    pageIndex: 0,
    x: -153,
    y: 591,
    width: 1970,
    height: 1239,
    rotation,
    zIndex: 1,
    opacity: 1,
    locked: false,
    visible: true,
    configJson: { variableKey: "course.studentList", fontFamily: "DM Sans", fontSize: 67, columns: 2 },
  };
}

function celdas(rotation: number) {
  const { document } = editorADocumento({
    canvas: { width: 3602, height: 2421, dpi: 300 },
    blocks: [listado(rotation)],
    listaDelCurso: nombres.map((firstName) => ({ firstName, lastName: "Pérez" })),
  });
  const sides = (document as { sides: { blocks: Record<string, number | string | undefined>[] }[] }).sides;
  return sides[0]!.blocks.filter((b) => String(b.id).startsWith("lista__"));
}

describe("editorADocumento — listado del curso girado", () => {
  it("cada alumno lleva el giro del bloque", () => {
    const todas = celdas(90.68);
    assert.equal(todas.length, nombres.length);
    for (const c of todas) assert.equal(c.rotation, 90.68);
  });

  it("cada alumno queda donde estaba, girado alrededor del centro del bloque", () => {
    const pxAmm = 25.4 / 300;
    const centroX = (-153 + 1970 / 2) * pxAmm;
    const centroY = (591 + 1239 / 2) * pxAmm;
    const derechas = celdas(0);
    const giradas = celdas(90);
    derechas.forEach((d, i) => {
      const g = giradas[i]!;
      const dx = Number(d.x) + Number(d.width) / 2 - centroX;
      const dy = Number(d.y) + Number(d.height) / 2 - centroY;
      // A 90° (sentido horario en pantalla) el punto (dx, dy) pasa a (-dy, dx).
      const esperadoX = centroX - dy;
      const esperadoY = centroY + dx;
      assert.ok(Math.abs(Number(g.x) + Number(g.width) / 2 - esperadoX) < 0.01, `${g.content} fuera de lugar a lo ancho`);
      assert.ok(Math.abs(Number(g.y) + Number(g.height) / 2 - esperadoY) < 0.01, `${g.content} fuera de lugar a lo alto`);
    });
  });

  it("sin giro el listado queda igual que antes", () => {
    for (const c of celdas(0)) assert.equal(c.rotation, undefined);
  });
});
