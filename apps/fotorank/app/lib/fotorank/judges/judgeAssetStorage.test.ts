/**
 * La clave lleva el hash del contenido: al cambiar la foto cambia la URL y
 * ningún navegador se queda con la anterior.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  buildJudgeAvatarKey,
  parseJudgeAvatarKey,
  hashJudgeAvatarContent,
  extensionForJudgeAvatarMime,
  contentTypeForJudgeAvatarExtension,
} from "./judgeAssetStorage";

test("la clave incluye la cuenta, el hash y la extensión", () => {
  assert.equal(
    buildJudgeAvatarKey("cuenta123", "abc123", "jpg"),
    "fotorank/judges/cuenta123/avatar/abc123.jpg",
  );
});

test("la clave se puede volver a leer", () => {
  const key = buildJudgeAvatarKey("cuenta123", "abc123", "webp");
  assert.deepEqual(parseJudgeAvatarKey(key), {
    judgeAccountId: "cuenta123",
    hash: "abc123",
    ext: "webp",
  });
});

test("una clave ajena no se interpreta como avatar de jurado", () => {
  assert.equal(parseJudgeAvatarKey("fotorank/entries/x/original.jpg"), null);
  assert.equal(parseJudgeAvatarKey("../../etc/passwd"), null);
});

test("el mismo contenido da el mismo hash y otro contenido da otro", () => {
  const a = hashJudgeAvatarContent(new Uint8Array([1, 2, 3]));
  const b = hashJudgeAvatarContent(new Uint8Array([1, 2, 3]));
  const c = hashJudgeAvatarContent(new Uint8Array([1, 2, 4]));
  assert.equal(a, b);
  assert.notEqual(a, c);
});

test("sólo se aceptan los tres formatos de imagen", () => {
  assert.equal(extensionForJudgeAvatarMime("image/jpeg"), "jpg");
  assert.equal(extensionForJudgeAvatarMime("image/png"), "png");
  assert.equal(extensionForJudgeAvatarMime("image/webp"), "webp");
  assert.equal(extensionForJudgeAvatarMime("image/gif"), null);
  assert.equal(extensionForJudgeAvatarMime(""), null);
});

test("cada extensión declara su tipo de contenido", () => {
  assert.equal(contentTypeForJudgeAvatarExtension("jpg"), "image/jpeg");
  assert.equal(contentTypeForJudgeAvatarExtension("png"), "image/png");
  assert.equal(contentTypeForJudgeAvatarExtension("webp"), "image/webp");
});
