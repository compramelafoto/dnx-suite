import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { esVistaDemo, usuarioParaVista } from "@/lib/demos/vistas";

describe("demos — vistas", () => {
  const ids = { fotografoId: 10, colegioUserId: 20 };

  it("la familia y el fotógrafo usan la sesión del fotógrafo; el colegio, la suya", () => {
    assert.equal(usuarioParaVista("fotografo", ids), 10);
    assert.equal(usuarioParaVista("familia", ids), 10);
    assert.equal(usuarioParaVista("colegio", ids), 20);
  });

  it("solo acepta las tres vistas", () => {
    assert.equal(esVistaDemo("colegio"), true);
    assert.equal(esVistaDemo("admin"), false);
    assert.equal(esVistaDemo(undefined), false);
  });
});
