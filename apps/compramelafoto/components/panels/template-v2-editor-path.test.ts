import assert from "node:assert/strict";
import { test } from "node:test";
import { isTemplateV2EditorPath } from "./template-v2-editor-path";

test("el editor de una versión va en pantalla completa", () => {
  assert.equal(isTemplateV2EditorPath("/fotografo/diseno/plantillas/v2/cmv36vjbc/cmv4bevk2"), true);
  assert.equal(isTemplateV2EditorPath("/fotografo/diseno/plantillas/v2/cmv36vjbc/cmv4bevk2/"), true);
});

test("probar una plantilla es una página común que se puede desplazar", () => {
  assert.equal(isTemplateV2EditorPath("/fotografo/diseno/plantillas/v2/cmv36vjbc/probar"), false);
  assert.equal(isTemplateV2EditorPath("/fotografo/diseno/plantillas/v2"), false);
  assert.equal(isTemplateV2EditorPath(null), false);
});
