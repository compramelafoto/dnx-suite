import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  LARGO_MAXIMO_RUTA,
  acabadoCorto,
  ajustarRuta,
  carpetaDeImpresion,
  carpetaDePedido,
  nombreDeCopia,
  tamanoCorto,
} from "./rutas-cortas";

describe("rutas cortas del ZIP de impresión", () => {
  it("sin acabado cargado no inventa Brillo", () => {
    assert.equal(acabadoCorto(null), "");
    assert.equal(acabadoCorto(""), "");
    assert.equal(acabadoCorto("MATE"), "Mate");
    assert.equal(carpetaDeImpresion({ tamano: "13x18", acabado: "", producto: "Foto impresa" }), "13x18");
  });

  it("tamaño sin cm y producto genérico afuera", () => {
    assert.equal(tamanoCorto("15x21 cm"), "15x21");
    assert.equal(tamanoCorto("10 x 15"), "10x15");
    assert.equal(carpetaDeImpresion({ tamano: "15x21", acabado: "Mate", producto: "Foto Impresa" }), "15x21 Mate");
    assert.equal(carpetaDeImpresion({ tamano: "10x10", acabado: "Brillo", producto: "Polaroids" }), "10x10 Brillo Polaroids");
  });

  it("nombres largos se recortan sin dejar espacios ni puntos al final", () => {
    assert.equal(carpetaDePedido("3888", "María Fernanda González Rodríguez de la Torre"), "3888 Maria Fernanda Gonzalez");
    assert.equal(
      nombreDeCopia(2, "DSC_20261012_evento_casamiento_salon_principal_toma_final_editada.JPG"),
      "2x DSC_20261012_evento_casamiento_salon_pri.jpg"
    );
    const carpeta = carpetaDeImpresion({
      tamano: "15x21",
      acabado: "Mate",
      producto: "Foto individual con la seño y el grupo completo",
    });
    assert.ok(carpeta.length <= 40 && !/[\s.]$/.test(carpeta), carpeta);
  });

  it("el peor caso real entra en el tope", () => {
    const ruta = [
      carpetaDeImpresion({ tamano: "15x21", acabado: "Semimate", producto: "Foto individual con la seño y el grupo completo" }),
      carpetaDePedido("123456", "María Fernanda González Rodríguez de la Torre"),
      nombreDeCopia(12, "DSC_20261012_evento_casamiento_salon_principal_toma_final_editada.jpg"),
    ].join("/");
    assert.ok(ruta.length <= LARGO_MAXIMO_RUTA, `${ruta.length}: ${ruta}`);
  });

  it("ajustarRuta recorta el archivo (no la extensión) y numera repetidos", () => {
    const usadas = new Set<string>();
    const larga = `carpeta/${"x".repeat(200)}.jpg`;
    const a = ajustarRuta(larga, usadas);
    const b = ajustarRuta(larga, usadas);
    assert.equal(a.length, LARGO_MAXIMO_RUTA);
    assert.ok(a.endsWith(".jpg") && a.startsWith("carpeta/"));
    assert.ok(b.endsWith(" (2).jpg") && b.length <= LARGO_MAXIMO_RUTA, b);
    assert.equal(ajustarRuta("corta/Foto.jpg", usadas), "corta/Foto.jpg");
    assert.equal(ajustarRuta("corta/foto.JPG", usadas), "corta/foto (2).JPG");
  });
});
