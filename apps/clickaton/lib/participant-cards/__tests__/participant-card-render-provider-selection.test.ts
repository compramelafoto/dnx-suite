/* eslint-disable turbo/no-undeclared-env-vars -- el test enciende y apaga las banderas documentadas */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { resolveParticipantCardRenderProvider } from "../participant-card-render-provider";

const ORIGINAL = process.env.CLICKATON_CARD_RENDER_PROVIDER;

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.CLICKATON_CARD_RENDER_PROVIDER;
  else process.env.CLICKATON_CARD_RENDER_PROVIDER = ORIGINAL;
});

/**
 * Sin configuración, las placas tienen que dibujarse con el motor que corre dentro de Vercel.
 * El motor con navegador exige un servidor aparte: si quedara de valor por defecto, cualquier
 * entorno mal configurado dejaría de generar placas sin que nadie lo pidiera.
 */
describe("resolveParticipantCardRenderProvider", () => {
  it("usa el motor sin navegador cuando no hay nada configurado", () => {
    delete process.env.CLICKATON_CARD_RENDER_PROVIDER;

    assert.equal(resolveParticipantCardRenderProvider().id, "design-studio");
  });

  it("respeta el motor con navegador si alguien lo pide expresamente", () => {
    process.env.CLICKATON_CARD_RENDER_PROVIDER = "local";

    assert.equal(resolveParticipantCardRenderProvider().id, "local-playwright");
  });

  it("respeta el worker remoto si alguien lo pide expresamente", () => {
    process.env.CLICKATON_CARD_RENDER_PROVIDER = "remote";

    assert.equal(resolveParticipantCardRenderProvider().id, "remote");
  });
});
