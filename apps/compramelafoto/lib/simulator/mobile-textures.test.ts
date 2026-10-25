import assert from "node:assert/strict";
import { test } from "node:test";
import { cappedSize } from "./mobile-textures";

test("texturas del celular: el lado mayor queda en el tope y se respeta la proporción", () => {
  assert.deepEqual(cappedSize(2048, 2048, 320), { width: 320, height: 320 });
  assert.deepEqual(cappedSize(1024, 5637, 320), { width: 58, height: 320 });
  assert.deepEqual(cappedSize(2048, 1024, 256), { width: 256, height: 128 });
});

test("texturas del celular: las que ya entran no se tocan", () => {
  assert.equal(cappedSize(256, 256, 320), null);
  assert.equal(cappedSize(0, 0, 320), null);
});
