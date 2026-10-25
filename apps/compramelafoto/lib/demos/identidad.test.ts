import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  esCorreoDePrueba,
  esUsuarioDemo,
  filtrarDestinatariosDePrueba,
  puedeAdministrarDemos,
} from "@/lib/demos/identidad";

describe("demos — identidad", () => {
  it("reconoce los correos .test, sin importar mayúsculas", () => {
    assert.equal(esCorreoDePrueba("fotografo@demo.compramelafoto.test"), true);
    assert.equal(esCorreoDePrueba("A@FOO.TEST"), true);
    assert.equal(esCorreoDePrueba("Demo <a@x.test>"), true);
    assert.equal(esCorreoDePrueba("a@gmail.com"), false);
    assert.equal(esCorreoDePrueba("a@testing.com"), false);
    assert.equal(esCorreoDePrueba("sin-arroba"), false);
  });

  it("solo el admin 1 administra demos", () => {
    assert.equal(puedeAdministrarDemos({ id: 1, role: "ADMIN" }), true);
    assert.equal(puedeAdministrarDemos({ id: 521, role: "ADMIN" }), false);
    assert.equal(puedeAdministrarDemos({ id: 1, role: "PHOTOGRAPHER" }), false);
    assert.equal(puedeAdministrarDemos(null), false);
  });

  it("un usuario es demo solo con la etiqueta", () => {
    assert.equal(esUsuarioDemo({ tags: ["DEMO_PRESENTACION"] }), true);
    assert.equal(esUsuarioDemo({ tags: ["DEMO_ESCOLAR"] }), false);
    assert.equal(esUsuarioDemo({ tags: null }), false);
    assert.equal(esUsuarioDemo(null), false);
  });

  it("separa los destinatarios que no se mandan", () => {
    assert.deepEqual(filtrarDestinatariosDePrueba(["a@x.test", "b@gmail.com"]), {
      enviar: ["b@gmail.com"],
      descartados: ["a@x.test"],
    });
    assert.deepEqual(filtrarDestinatariosDePrueba("a@x.test"), { enviar: [], descartados: ["a@x.test"] });
  });
});
