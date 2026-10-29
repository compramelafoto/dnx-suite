import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { editorADocumento, type EditorBlock } from "../design-studio-bridge";
import { applyTemplateData } from "@repo/template-engine";

/**
 * El bloque «Calendario» llega entero al PDF: cada mes con su nombre, los días de la semana y
 * todos los días del año elegido (en su color los domingos). Cambiar el año en «Datos de la
 * plantilla» cambia lo que se imprime.
 */
function calendario(year: number, extra: Record<string, unknown> = {}): EditorBlock {
  return {
    id: "cal",
    type: "VARIABLE_TEXT",
    name: "Calendario",
    pageIndex: 0,
    x: 100,
    y: 1200,
    width: 2280,
    height: 2100,
    rotation: 0,
    zIndex: 1,
    opacity: 1,
    locked: false,
    visible: true,
    configJson: {
      variableKey: "calendar.grid",
      fontFamily: "Montserrat",
      fontSize: 40,
      color: "#222222",
      calendar: { year, month: 0, columns: 3, sundayColor: "#cc0000", ...extra },
    },
  };
}

function textos(bloques: EditorBlock[]) {
  const { document } = editorADocumento({ canvas: { width: 2480, height: 3508, dpi: 300 }, blocks: bloques });
  const sides = (document as { sides: { blocks: Record<string, unknown>[] }[] }).sides;
  return sides[0]!.blocks.filter((b) => String(b.id).startsWith("cal__"));
}

describe("editorADocumento — calendario", () => {
  it("imprime los 12 meses y todos los días del año", () => {
    const t = textos([calendario(2027)]);
    assert.equal(t.length, 12 + 12 * 7 + 365);
    assert.equal(textos([calendario(2028)]).length, 12 + 12 * 7 + 366, "2028 es bisiesto");
    assert.ok(t.some((b) => b.content === "Enero"));
    assert.ok(t.every((b) => b.type === "text" && Number(b.width) > 0));
  });

  it("los domingos salen en su color", () => {
    const t = textos([calendario(2027, { month: 2 })]);
    const rojos = t.filter((b) => b.color === "#cc0000" && /^\d+$/.test(String(b.content))).map((b) => b.content);
    assert.deepEqual(rojos, ["7", "14", "21", "28"]);
  });

  it("cambiar el año en los datos de la plantilla cambia lo impreso", () => {
    const [nuevo] = applyTemplateData([calendario(2027, { month: 2 })], "calendar.year", "2028");
    const dias = textos([nuevo!]).filter((b) => /^\d+$/.test(String(b.content)));
    assert.equal(dias.length, 29, "febrero de 2028 tiene 29 días");
  });
});
