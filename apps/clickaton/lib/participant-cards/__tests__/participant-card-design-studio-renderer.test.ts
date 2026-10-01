import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createClickatonTemplateExampleData } from "@repo/template-engine";
import { resolveClickatonParticipantCardDocument } from "../participant-card-renderer";
import {
  DesignStudioRenderProvider,
  renderClickatonParticipantCardWithDesignStudio,
} from "../participant-card-design-studio-renderer";

/**
 * El motor de `design-studio` dibuja sin navegador, igual que el carnet impreso de FotoOffice.
 * Estos tests no toleran la ausencia de Chromium: si alguna vez hiciera falta un navegador
 * para generar una placa, tienen que fallar.
 */

/**
 * Las medidas reales del archivo, leídas de su cabecera.
 *
 * Se miden del PNG y no se toman del resultado a propósito: el resultado dice lo que el código
 * cree haber dibujado, y lo que importa es lo que el participante se descarga.
 */
function medidasDelPng(png: Buffer): { width: number; height: number } {
  const firma = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.ok(png.subarray(0, 8).equals(firma), "el archivo no es un PNG");
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

describe("renderClickatonParticipantCardWithDesignStudio", () => {
  it("dibuja la placa de bienvenida a 1080×1920 sin navegador", async () => {
    const result = await renderClickatonParticipantCardWithDesignStudio({
      cardType: "welcome",
      templateData: createClickatonTemplateExampleData(),
    });

    assert.equal(result.mimeType, "image/png");
    assert.deepEqual(medidasDelPng(result.png), { width: 1080, height: 1920 });
    assert.equal(result.width, 1080);
    assert.equal(result.height, 1920);
  });

  it("dibuja la placa «Soy parte» sin navegador", async () => {
    const result = await renderClickatonParticipantCardWithDesignStudio({
      cardType: "member",
      templateData: createClickatonTemplateExampleData(),
    });

    assert.deepEqual(medidasDelPng(result.png), { width: 1080, height: 1920 });
    assert.equal(result.sourceSummary.templateKey, "CLICKATON_MEMBER_STORY_V1");
  });

  it("no deja avisos de bloques que no supo dibujar", async () => {
    const result = await renderClickatonParticipantCardWithDesignStudio({
      cardType: "welcome",
      templateData: createClickatonTemplateExampleData(),
    });

    assert.deepEqual(
      result.renderWarnings.filter((a) => a.includes("No se pudo imprimir")),
      []
    );
  });
});

/**
 * El proveedor es la pieza que encaja en el resto del sistema: recibe el documento con las
 * variables ya resueltas —el mismo que recibía el navegador— y devuelve el PNG.
 */
describe("DesignStudioRenderProvider", () => {
  it("dibuja el documento ya resuelto que recibe el resto del sistema", async () => {
    const { document } = resolveClickatonParticipantCardDocument({
      cardType: "welcome",
      templateData: createClickatonTemplateExampleData(),
    });

    const provider = new DesignStudioRenderProvider();
    const rendered = await provider.render({ document });

    assert.deepEqual(medidasDelPng(rendered.png), { width: 1080, height: 1920 });
    assert.equal(rendered.width, 1080);
    assert.equal(rendered.height, 1920);
  });

  it("se llama «design-studio», que es lo que se configura en el entorno", () => {
    assert.equal(new DesignStudioRenderProvider().id, "design-studio");
  });
});
