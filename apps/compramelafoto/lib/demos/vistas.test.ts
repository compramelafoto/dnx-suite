import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  destinoDeVista,
  esVistaDemo,
  sesionDeRol,
  sesionParaVista,
  usuarioParaVista,
  VISTAS_DEMO,
} from "@/lib/demos/vistas";

describe("demos — vistas", () => {
  const ids = { fotografoId: 10, colegioUserId: 20, organizadorUserId: 30 };

  it("la familia y el fotógrafo usan la sesión del fotógrafo; el colegio y el organizador, la suya", () => {
    assert.equal(usuarioParaVista("fotografo", ids), 10);
    assert.equal(usuarioParaVista("familia", ids), 10);
    assert.equal(usuarioParaVista("colegio", ids), 20);
    assert.equal(usuarioParaVista("organizador", ids), 30);
  });

  it("sin organizador creado, la vista organizador no tiene usuario", () => {
    assert.equal(usuarioParaVista("organizador", { fotografoId: 10, colegioUserId: 20 }), null);
    assert.equal(usuarioParaVista("organizador", { ...ids, organizadorUserId: null }), null);
  });

  it("solo acepta las cuatro vistas", () => {
    assert.equal(esVistaDemo("colegio"), true);
    assert.equal(esVistaDemo("organizador"), true);
    assert.equal(esVistaDemo("admin"), false);
    assert.equal(esVistaDemo(undefined), false);
  });

  it("la barra muestra la empresa de turismo", () => {
    assert.ok(VISTAS_DEMO.some((v) => v.id === "organizador" && v.etiqueta === "Empresa de turismo"));
  });

  it("cada vista lleva a su pantalla y pide su sesión", () => {
    const ctx = { schoolId: 5, handler: "estudiodemo" };
    assert.equal(destinoDeVista("organizador", ctx), "/organizador/dashboard");
    assert.equal(destinoDeVista("colegio", ctx), "/escuela/5");
    assert.equal(destinoDeVista("familia", ctx), "/estudiodemo/escolar");
    assert.equal(destinoDeVista("fotografo", ctx), "/fotografo/escuelas");
    assert.equal(sesionParaVista("familia"), "fotografo");
    assert.equal(sesionParaVista("organizador"), "organizador");
    assert.equal(sesionDeRol("ORGANIZER"), "organizador");
    assert.equal(sesionDeRol("SCHOOL_ORGANIZER"), "colegio");
    assert.equal(sesionDeRol("PHOTOGRAPHER"), "fotografo");
  });
});
