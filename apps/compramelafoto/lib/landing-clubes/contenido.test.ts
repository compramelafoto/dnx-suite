import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { CONTENIDO_CLUBES, paginaClubesVisible } from "./contenido";

const RAIZ_CLF = join(__dirname, "..", "..");

function todosLosTextos(): string[] {
  const c = CONTENIDO_CLUBES;
  return [
    c.titulo,
    c.bajada,
    ...c.pasos.flatMap((p) => [p.titulo, p.texto]),
    ...c.funciones.flatMap((f) => [f.titulo, f.texto]),
    c.cta.texto,
  ];
}

describe("página de clubes y organizadores", () => {
  it("usa sólo las cuatro funciones que CLF tiene", () => {
    const claves = CONTENIDO_CLUBES.funciones.map((f) => f.clave).sort();
    assert.deepEqual(claves, [
      "COMISION_ORGANIZADOR",
      "FOTOGRAFOS_OFICIALES",
      "RECONOCIMIENTO_FACIAL",
      "VENTA_EN_ALBUM",
    ]);
    for (const f of CONTENIDO_CLUBES.funciones) {
      assert.ok(f.fuente.trim().length > 0, `${f.clave} sin fuente`);
      for (const ruta of f.fuente.split(",").map((r) => r.trim())) {
        assert.ok(existsSync(join(RAIZ_CLF, ruta)), `${f.clave}: no existe ${ruta}`);
      }
    }
  });

  it("habla de ganar dinero sin invertir dinero y nunca de plata", () => {
    const todo = todosLosTextos().join("\n");
    assert.match(todo, /sin invertir dinero/i);
    assert.match(todo, /ganar dinero/i);
    assert.doesNotMatch(todo, /\bplata\b/i);
  });

  it("no promete descuentos ni porcentajes fijos", () => {
    for (const t of todosLosTextos()) {
      assert.doesNotMatch(t, /descuento|\d+\s?%/i, t);
    }
  });

  it("lleva al registro de organizador", () => {
    assert.equal(CONTENIDO_CLUBES.cta.href, "/registro/organizador");
    assert.ok(CONTENIDO_CLUBES.cta.texto.trim().length > 0);
  });

  it("no publicada: la ve sólo un admin", () => {
    assert.equal(paginaClubesVisible({ publicada: false, esAdmin: false }), false);
    assert.equal(paginaClubesVisible({ publicada: false, esAdmin: true }), true);
    assert.equal(paginaClubesVisible({ publicada: true, esAdmin: false }), true);
  });
});
