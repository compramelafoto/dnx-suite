import assert from "node:assert/strict";
import { test } from "node:test";
import { addGuide, isGuideInsideCanvas, moveGuide, readGuides, removeGuide } from "../editor-guides";
import {
  selectCanUndo,
  selectGuides,
  setGuides,
  TEMPLATE_V2_EDITOR_INITIAL_STATE,
  templateV2EditorReducer,
  undo,
} from "../editor-store";

test("una plantilla sin guías y una meta rota dan listas vacías", () => {
  assert.deepEqual(readGuides({}), { v: [], h: [] });
  assert.deepEqual(readGuides({ guides: { v: [10, "x", null], h: "nada" } }), { v: [10], h: [] });
});

test("agregar, mover y borrar", () => {
  let g = addGuide({ v: [], h: [] }, "v", 1800.04);
  g = addGuide(g, "h", 300);
  assert.deepEqual(g, { v: [1800], h: [300] });
  g = moveGuide(g, "v", 0, 900.26);
  assert.deepEqual(g.v, [900.3]);
  g = removeGuide(g, "h", 0);
  assert.deepEqual(g, { v: [900.3], h: [] });
  assert.equal(removeGuide(g, "v", 5), g);
});

test("soltada fuera de la hoja se descarta", () => {
  assert.equal(isGuideInsideCanvas("v", -3, 3602, 2421), false);
  assert.equal(isGuideInsideCanvas("h", 2500, 3602, 2421), false);
  assert.equal(isGuideInsideCanvas("h", 1200, 3602, 2421), true);
});

test("las guías van a la meta, marcan cambios y se pueden deshacer", () => {
  const s0 = { ...TEMPLATE_V2_EDITOR_INITIAL_STATE, loadStatus: "ready" as const };
  const s1 = templateV2EditorReducer(s0, setGuides({ v: [100], h: [] }));
  assert.deepEqual(selectGuides(s1), { v: [100], h: [] });
  assert.equal(s1.isDirty, true);
  assert.equal(selectCanUndo(s1), true);
  const s2 = templateV2EditorReducer(s1, undo());
  assert.deepEqual(selectGuides(s2), { v: [], h: [] });
});
