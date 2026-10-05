import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { construirEntradaDeEmitDesign } from "@/lib/participant-cards/participant-card-design-studio-renderer";

const bloqueQrVariable = {
  id: "qr1",
  type: "QR",
  x: 100,
  y: 100,
  width: 200,
  height: 200,
  configJson: { mode: "VARIABLE", variableKey: "verificationUrl", errorCorrection: "M" },
};

describe("las variables que el QR necesita llegan al motor", () => {
  it("declara la variable del QR en el contrato y le pasa el valor", () => {
    const entrada = construirEntradaDeEmitDesign({
      blocks: [bloqueQrVariable],
      canvas: { width: 1754, height: 1240 },
      templateData: {
        diploma: { verificationUrl: "https://maratonfotografica.com/diplomas/verificar/abc123" },
      },
    });

    assert.ok(
      entrada.contract.variables.some((v) => v.key === "verificationUrl"),
      "el contrato tiene que declarar la variable del QR"
    );
    assert.equal(
      entrada.values.verificationUrl,
      "https://maratonfotografica.com/diplomas/verificar/abc123"
    );
  });

  it("no pierde las variables sintéticas de un QR de dirección fija", () => {
    const entrada = construirEntradaDeEmitDesign({
      blocks: [
        {
          id: "qr2",
          type: "QR",
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          configJson: { mode: "FIXED", value: "https://maratonfotografica.com" },
        },
      ],
      canvas: { width: 1754, height: 1240 },
      templateData: {},
    });

    const claves = entrada.contract.variables.map((v) => v.key);
    assert.equal(claves.length, 1);
    assert.equal(entrada.values[claves[0]!], "https://maratonfotografica.com");
  });

  it("una pieza sin ningún QR sigue yendo con contrato vacío", () => {
    const entrada = construirEntradaDeEmitDesign({
      blocks: [
        { id: "t1", type: "TEXT", x: 0, y: 0, width: 100, height: 20, configJson: { content: "hola" } },
      ],
      canvas: { width: 1080, height: 1920 },
      templateData: {},
    });
    assert.deepEqual(entrada.contract.variables, []);
    assert.deepEqual(entrada.values, {});
  });

  it("encuentra el valor por la clave corta aunque el dato esté guardado con la ruta completa", () => {
    const entrada = construirEntradaDeEmitDesign({
      blocks: [
        {
          id: "qr3",
          type: "QR",
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          configJson: { mode: "VARIABLE", variableKey: "diploma.verificationUrl" },
        },
      ],
      canvas: { width: 1754, height: 1240 },
      templateData: { "diploma.verificationUrl": "https://maratonfotografica.com/v/xyz" },
    });

    assert.equal(entrada.values["diploma.verificationUrl"], "https://maratonfotografica.com/v/xyz");
  });

  it("declara la variable con cadena vacía cuando el dato no aparece, en vez de omitirla", () => {
    const entrada = construirEntradaDeEmitDesign({
      blocks: [bloqueQrVariable],
      canvas: { width: 1754, height: 1240 },
      templateData: {},
    });

    assert.ok(entrada.contract.variables.some((v) => v.key === "verificationUrl"));
    assert.equal(entrada.values.verificationUrl, "");
  });
});
