import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  avisoDeBordes,
  medidaDeCopia,
  orientacionDeLaFoto,
  TEXTO_DIGITAL,
  textoFormatoCopia,
} from "./formato-de-la-foto";

describe("orientacionDeLaFoto", () => {
  it("distingue horizontal, vertical y cuadrada", () => {
    assert.equal(orientacionDeLaFoto(6000, 4000), "horizontal");
    assert.equal(orientacionDeLaFoto(4000, 6000), "vertical");
    assert.equal(orientacionDeLaFoto(1000, 1000), "cuadrada");
    assert.equal(orientacionDeLaFoto(1000, 980), "cuadrada");
  });

  it("sin medidas no adivina", () => {
    assert.equal(orientacionDeLaFoto(0, 0), null);
    assert.equal(orientacionDeLaFoto(null, 400), null);
    assert.equal(orientacionDeLaFoto(undefined, undefined), null);
  });
});

describe("medidaDeCopia", () => {
  it("normaliza las formas en que se carga la medida", () => {
    assert.equal(medidaDeCopia("15x21"), "15x21");
    assert.equal(medidaDeCopia("15x21 cm"), "15x21");
    assert.equal(medidaDeCopia(" 15 X 21 "), "15x21");
    assert.equal(medidaDeCopia("13×18"), "13x18");
  });

  it("lo que no es una medida no se muestra", () => {
    assert.equal(medidaDeCopia("DIGITAL"), null);
    assert.equal(medidaDeCopia(""), null);
    assert.equal(medidaDeCopia(null), null);
    assert.equal(medidaDeCopia("Foto impresa"), null);
  });
});

describe("textoFormatoCopia", () => {
  it("dice la medida y el sentido de la foto", () => {
    assert.equal(textoFormatoCopia("15x21", "horizontal"), "Copia 15x21 · se imprime horizontal");
    assert.equal(textoFormatoCopia("15x21 cm", "vertical"), "Copia 15x21 · se imprime vertical");
  });

  it("sin medida no inventa una", () => {
    assert.equal(textoFormatoCopia(null, "horizontal"), "Copia impresa · se imprime horizontal");
  });

  it("si no se sabe la forma, o es cuadrada, no promete un sentido", () => {
    assert.equal(textoFormatoCopia("15x21", null), "Copia 15x21 · se imprime en el sentido de la foto");
    assert.equal(textoFormatoCopia("15x21", "cuadrada"), "Copia 15x21 · se imprime en el sentido de la foto");
  });
});

describe("avisoDeBordes", () => {
  it("una foto de cámara (3:2) en 15x21 avisa de los bordes, en cualquier sentido", () => {
    assert.match(avisoDeBordes("15x21", 6000, 4000) ?? "", /borde finito/);
    assert.match(avisoDeBordes("15x21", 4000, 6000) ?? "", /papel 15x21/);
  });

  it("si la foto ya tiene la forma del papel, no avisa", () => {
    assert.equal(avisoDeBordes("15x21", 2100, 1500), null);
    assert.equal(avisoDeBordes("10x15", 6000, 4000), null);
  });

  it("sin medida o sin foto, no avisa", () => {
    assert.equal(avisoDeBordes(null, 6000, 4000), null);
    assert.equal(avisoDeBordes("15x21", null, null), null);
  });
});

describe("TEXTO_DIGITAL", () => {
  it("es el texto acordado", () => {
    assert.equal(TEXTO_DIGITAL, "Digital en alta calidad, en su formato original");
  });
});
