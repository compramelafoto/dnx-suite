import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { claveDeCurso, grupalParaGuardar } from "./grupal-del-curso";

describe("claveDeCurso", () => {
  it("el mismo curso escrito distinto da la misma clave", () => {
    assert.equal(claveDeCurso({ name: "5°", division: "A" }), claveDeCurso({ name: " 5°  ", division: "a " }));
    assert.equal(claveDeCurso({ name: "5°", division: "A" }), "5° a");
  });

  it("sin curso no hay clave", () => {
    assert.equal(claveDeCurso(null), null);
    assert.equal(claveDeCurso(undefined), null);
    assert.equal(claveDeCurso({ name: "  ", division: "A" }), null);
  });

  it("cursos distintos dan claves distintas", () => {
    assert.notEqual(claveDeCurso({ name: "5°", division: "A" }), claveDeCurso({ name: "5°", division: "B" }));
  });
});

describe("grupalParaGuardar", () => {
  it("guarda la grupal si está entre las fotos del canje", () => {
    assert.equal(grupalParaGuardar(9, [4, 9]), 9);
  });

  it("no guarda una foto que no se eligió", () => {
    assert.equal(grupalParaGuardar(9, [4]), null);
  });

  it("pack sin grupal: no guarda nada", () => {
    assert.equal(grupalParaGuardar(undefined, [4]), null);
  });
});
