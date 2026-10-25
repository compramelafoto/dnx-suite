import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { editorADocumento, type EditorBlock } from "../design-studio-bridge";
import { getTextVisualConfig, normalizeBlockConfig, readTextVerticalAlign } from "../render-core";
import { buildPasteStyleUpdate, extractBlockStyle } from "../block-style-clipboard";

/**
 * Alineación vertical del texto: arriba, centro o abajo dentro de la caja.
 *
 * El caso que la pidió: el listado de 7.º A de la carpeta de San Patricio va girado 90° y quedaba
 * pegado al pliegue, con un hueco vacío del otro lado del recuadro.
 */

function bloque(type: "TEXT" | "VARIABLE_TEXT", configJson: Record<string, unknown>, extra: Partial<EditorBlock> = {}): EditorBlock {
  return {
    id: "b",
    type,
    name: null,
    pageIndex: 0,
    x: 100,
    y: 100,
    width: 1000,
    height: 600,
    rotation: 0,
    zIndex: 1,
    opacity: 1,
    locked: false,
    visible: true,
    configJson,
    ...extra,
  };
}

function bloquesDelDocumento(blocks: EditorBlock[], lista?: { firstName: string; lastName: string }[]) {
  const { document } = editorADocumento({
    canvas: { width: 3602, height: 2421, dpi: 300 },
    blocks,
    ...(lista ? { listaDelCurso: lista } : {}),
  });
  return (document as { sides: { blocks: Record<string, unknown>[] }[] }).sides[0]!.blocks;
}

describe("alineación vertical — lectura de la opción guardada", () => {
  it("sin valor o con uno desconocido es arriba, como todos los diseños anteriores", () => {
    assert.equal(readTextVerticalAlign({}), "TOP");
    assert.equal(readTextVerticalAlign({ verticalAlign: "medio" }), "TOP");
    assert.equal(readTextVerticalAlign({ verticalAlign: "MIDDLE" }), "MIDDLE");
    assert.equal(readTextVerticalAlign({ verticalAlign: "bottom" }), "BOTTOM");
  });

  it("guardar conserva centro y abajo, y no agrega nada a un diseño que no la usa", () => {
    for (const tipo of ["TEXT", "VARIABLE_TEXT"] as const) {
      assert.equal(normalizeBlockConfig(tipo, { verticalAlign: "MIDDLE" }).verticalAlign, "MIDDLE");
      assert.equal(normalizeBlockConfig(tipo, { verticalAlign: "BOTTOM" }).verticalAlign, "BOTTOM");
      assert.equal("verticalAlign" in normalizeBlockConfig(tipo, {}), false);
      assert.equal("verticalAlign" in normalizeBlockConfig(tipo, { verticalAlign: "TOP" }), false);
    }
  });

  it("la vista de pantalla la recibe en minúsculas", () => {
    assert.equal(getTextVisualConfig({}).verticalAlign, "top");
    assert.equal(getTextVisualConfig({ verticalAlign: "MIDDLE" }).verticalAlign, "middle");
  });

  it("copiar y pegar estilo la lleva de un texto a otro", () => {
    const origen = { ...bloque("TEXT", { content: "a", verticalAlign: "BOTTOM" }), layout: { x: 0, y: 0, width: 1, height: 1, rotation: 0, zIndex: 0, opacity: 1, locked: false, visible: true } };
    const destino = { ...bloque("VARIABLE_TEXT", { variableKey: "x" }), layout: origen.layout };
    const clip = extractBlockStyle(origen as never);
    assert.ok(clip);
    const pegado = buildPasteStyleUpdate(clip, destino as never);
    assert.equal(pegado?.configJson.verticalAlign, "BOTTOM");
  });
});

describe("alineación vertical — editorADocumento", () => {
  it("texto fijo y dato variable pasan la alineación al documento de impresión", () => {
    const [fijo] = bloquesDelDocumento([bloque("TEXT", { content: "Hola", verticalAlign: "MIDDLE" })]);
    assert.equal(fijo!.verticalAlign, "middle");
    const [variable] = bloquesDelDocumento([
      bloque("VARIABLE_TEXT", { variableKey: "student.firstName", verticalAlign: "BOTTOM" }),
    ]);
    assert.equal(variable!.verticalAlign, "bottom");
  });

  it("arriba no se escribe: el documento es el mismo de antes", () => {
    const [fijo] = bloquesDelDocumento([bloque("TEXT", { content: "Hola" })]);
    assert.equal("verticalAlign" in fijo!, false);
    const [explicito] = bloquesDelDocumento([bloque("TEXT", { content: "Hola", verticalAlign: "TOP" })]);
    assert.equal("verticalAlign" in explicito!, false);
  });

  /*
   * El bloque real de 7.º A en la carpeta de San Patricio: girado 90,68°, dos columnas, Helvetica
   * 67 con interlineado 1,3. Centrado, los alumnos se reparten alrededor del centro del recuadro
   * (que es también el centro de giro), así que el promedio de sus centros cae en él.
   */
  const sanPatricio = (verticalAlign?: string) =>
    bloque(
      "VARIABLE_TEXT",
      {
        variableKey: "course.studentList",
        fontFamily: "Helvetica",
        fontSize: 67,
        lineHeight: 1.3,
        textAlign: "CENTER",
        textTransform: "capitalize",
        classList: { sortBy: "lastName", columns: 2, nameOrder: "firstLast", givenNames: "all", highlightOwner: true },
        ...(verticalAlign ? { verticalAlign } : {}),
      },
      { id: "lista", x: -153.4737183511329, y: 590.8512944622227, width: 1969.923309783439, height: 1239.297411075555, rotation: 90.68413159032582 },
    );
  const alumnos = Array.from({ length: 16 }, (_, i) => ({ firstName: `Alumno${i}`, lastName: `Apellido${i}` }));

  function centroDeLasCeldas(verticalAlign?: string) {
    const celdas = bloquesDelDocumento([sanPatricio(verticalAlign)], alumnos);
    assert.equal(celdas.length, alumnos.length);
    for (const c of celdas) assert.equal("verticalAlign" in c, false, "cada alumno va arriba de su celda");
    const cx = celdas.reduce((s, c) => s + Number(c.x) + Number(c.width) / 2, 0) / celdas.length;
    const cy = celdas.reduce((s, c) => s + Number(c.y) + Number(c.height) / 2, 0) / celdas.length;
    return { cx, cy };
  }

  it("el listado girado de San Patricio, centrado, queda en el centro de su recuadro", () => {
    const mm = 25.4 / 300;
    const centroX = (-153.4737183511329 + 1969.923309783439 / 2) * mm;
    const centroY = (590.8512944622227 + 1239.297411075555 / 2) * mm;
    const centro = centroDeLasCeldas("MIDDLE");
    assert.ok(Math.abs(centro.cx - centroX) < 0.01, `x ${centro.cx} contra ${centroX}`);
    assert.ok(Math.abs(centro.cy - centroY) < 0.01, `y ${centro.cy} contra ${centroY}`);
  });

  it("arriba, el listado girado queda corrido hacia el lado de arriba de las letras (la derecha)", () => {
    // Girado ~90° en sentido horario, la parte de arriba del recuadro mira a la derecha de la hoja.
    const arriba = centroDeLasCeldas();
    const abajo = centroDeLasCeldas("BOTTOM");
    const centro = centroDeLasCeldas("MIDDLE");
    assert.ok(arriba.cx > centro.cx + 5, `arriba ${arriba.cx}, centro ${centro.cx}`);
    assert.ok(abajo.cx < centro.cx - 5, `abajo ${abajo.cx}, centro ${centro.cx}`);
    // Centro reparte el hueco en partes iguales: queda justo entre arriba y abajo.
    assert.ok(Math.abs((arriba.cx + abajo.cx) / 2 - centro.cx) < 0.01);
  });
});
