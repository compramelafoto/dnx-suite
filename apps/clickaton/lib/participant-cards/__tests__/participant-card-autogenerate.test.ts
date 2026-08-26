import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  AUTO_GENERATED_CARD_TYPES,
  autoGenerateParticipantCardsForRegistration,
  enqueueParticipantCardsAfterPaid,
  isParticipantCardAutoGenerationEnabled,
  processDueParticipantCards,
} from "../participant-card-autogenerate";

const FLAG_KEYS = [
  "CLICKATON_PARTICIPANT_CARDS_V2_ENABLED",
  "CLICKATON_PARTICIPANT_CARDS_PERSISTENCE_ENABLED",
  "CLICKATON_CARD_RENDER_PROVIDER",
  "CLICKATON_CARD_REMOTE_RENDER_URL",
  "DNX_TEMPLATE_RENDER_HMAC_SECRET",
  "CLICKATON_PARTICIPANT_CARDS_STORAGE_PROVIDER",
] as const;

const original = new Map(FLAG_KEYS.map((k) => [k, process.env[k]]));

afterEach(() => {
  for (const [key, value] of original) {
    if (value == null) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("autogeneración de placas de participante", () => {
  it("genera welcome y member por defecto", () => {
    assert.deepEqual(AUTO_GENERATED_CARD_TYPES, ["welcome", "member"]);
  });

  it("queda deshabilitada si falta alguna flag", () => {
    delete process.env.CLICKATON_PARTICIPANT_CARDS_V2_ENABLED;
    delete process.env.CLICKATON_PARTICIPANT_CARDS_PERSISTENCE_ENABLED;
    assert.equal(isParticipantCardAutoGenerationEnabled(), false);

    process.env.CLICKATON_PARTICIPANT_CARDS_V2_ENABLED = "true";
    assert.equal(
      isParticipantCardAutoGenerationEnabled(),
      false,
      "V2 sin persistencia no debe autogenerar"
    );
  });

  it("con flags off no toca la base y devuelve FLAG_OFF", async () => {
    delete process.env.CLICKATON_PARTICIPANT_CARDS_V2_ENABLED;
    delete process.env.CLICKATON_PARTICIPANT_CARDS_PERSISTENCE_ENABLED;

    const result = await autoGenerateParticipantCardsForRegistration({
      registrationId: "reg_inexistente",
    });

    assert.equal(result.attempted, false);
    assert.equal(result.outcomes.length, 2);
    for (const outcome of result.outcomes) {
      assert.equal(outcome.ok, false);
      assert.equal(outcome.skipReason, "FLAG_OFF");
    }
  });

  it("con provider remote mal configurado no intenta generar", async () => {
    process.env.CLICKATON_PARTICIPANT_CARDS_V2_ENABLED = "true";
    process.env.CLICKATON_PARTICIPANT_CARDS_PERSISTENCE_ENABLED = "true";
    process.env.CLICKATON_CARD_RENDER_PROVIDER = "remote";
    delete process.env.CLICKATON_CARD_REMOTE_RENDER_URL;
    delete process.env.DNX_TEMPLATE_RENDER_HMAC_SECRET;

    const result = await autoGenerateParticipantCardsForRegistration({
      registrationId: "reg_inexistente",
    });

    assert.equal(result.attempted, false);
    assert.equal(result.outcomes[0]?.skipReason, "RUNTIME_CONFIG_INVALID");
  });

  it("el cron reporta enabled:false sin escanear cuando está apagado", async () => {
    delete process.env.CLICKATON_PARTICIPANT_CARDS_V2_ENABLED;
    delete process.env.CLICKATON_PARTICIPANT_CARDS_PERSISTENCE_ENABLED;

    const result = await processDueParticipantCards(10);
    assert.deepEqual(result, {
      enabled: false,
      scanned: 0,
      processed: 0,
      generated: 0,
      failed: 0,
      results: [],
    });
  });

  it("el hook post-pago nunca lanza", () => {
    delete process.env.CLICKATON_PARTICIPANT_CARDS_V2_ENABLED;
    assert.doesNotThrow(() =>
      enqueueParticipantCardsAfterPaid({ registrationId: "reg_inexistente" })
    );
  });
});
