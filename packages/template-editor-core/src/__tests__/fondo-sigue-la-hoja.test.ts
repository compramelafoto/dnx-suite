import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ajustarFondosAlLienzo,
  setCanvas,
  TEMPLATE_V2_EDITOR_INITIAL_STATE,
  templateV2EditorReducer,
} from "../editor-store";
import type { TemplateV2Block } from "../render-core";

function bloque(type: TemplateV2Block["type"], x: number, y: number, width: number, height: number, pageIndex = 0) {
  return {
    id: `${type}-${pageIndex}-${x}`,
    type,
    pageIndex,
    name: type,
    layout: { x, y, width, height, rotation: 0, zIndex: 0, opacity: 1, locked: true, visible: true },
    configJson: {},
  } as TemplateV2Block;
}

const vieja = { width: 1200, height: 1800 };
const carpeta = { width: 3602, height: 2421 };

test("el fondo que cubría la hoja la sigue al cambiar de tamaño, en todas las hojas", () => {
  const out = ajustarFondosAlLienzo(
    [bloque("BACKGROUND", 0, 0, 1200, 1800, 0), bloque("BACKGROUND", 0, 0, 1200, 1800, 1)],
    vieja,
    carpeta,
  );
  for (const b of out) {
    assert.equal(b.layout.width, 3602);
    assert.equal(b.layout.height, 2421);
  }
});

test("un fondo achicado a propósito y los demás bloques no se tocan", () => {
  const chico = bloque("BACKGROUND", 100, 100, 500, 500);
  const foto = bloque("PHOTO", 0, 0, 1200, 1800);
  const out = ajustarFondosAlLienzo([chico, foto], vieja, carpeta);
  assert.deepEqual(out, [chico, foto]);
});

test("el reducer ajusta el fondo cuando cambia la hoja", () => {
  const estado = templateV2EditorReducer(
    {
      ...TEMPLATE_V2_EDITOR_INITIAL_STATE,
      canvas: { ...vieja, background: "#fff" },
      blocks: [bloque("BACKGROUND", 0, 0, 1200, 1800)],
    },
    setCanvas(carpeta),
  );
  assert.equal(estado.blocks[0]!.layout.width, 3602);
  assert.equal(estado.blocks[0]!.layout.height, 2421);
});
