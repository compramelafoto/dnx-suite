import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MemoryParticipantCardAssetStore,
  buildParticipantCardStorageKey,
} from "@/lib/participant-cards";

describe("buildParticipantCardStorageKey", () => {
  it("builds deterministic path without PII", () => {
    const key = buildParticipantCardStorageKey({
      editionId: "ed_123",
      registrationId: "reg_456",
      cardType: "welcome",
      templateVersion: 1,
      renderHash: "abc123def456",
    });
    assert.equal(
      key,
      "clickaton/participant-cards/edition-ed_123/registration-reg_456/welcome/v1/abc123def456.png"
    );
    assert.ok(!key.includes("@"));
    assert.ok(!key.includes("anafoto"));
  });

  it("sanitizes unsafe segments", () => {
    const key = buildParticipantCardStorageKey({
      editionId: "ed/with spaces!",
      registrationId: "reg@email.com",
      cardType: "member",
      templateVersion: 2,
      renderHash: "hash/with/slash",
    });
    assert.match(key, /^clickaton\/participant-cards\//);
    assert.ok(!key.includes(" "));
    assert.ok(!key.includes("@"));
  });

  it("da una carpeta distinta a cada tipo de pieza", () => {
    const base = {
      editionId: "ed_1",
      registrationId: "reg_1",
      templateVersion: 1,
      renderHash: "hash1",
    };
    const welcome = buildParticipantCardStorageKey({ ...base, cardType: "welcome" });
    const member = buildParticipantCardStorageKey({ ...base, cardType: "member" });
    const diploma = buildParticipantCardStorageKey({ ...base, cardType: "diploma" });

    assert.ok(welcome.includes("/welcome/"));
    assert.ok(member.includes("/member/"));
    assert.ok(diploma.includes("/diploma/"));
    assert.equal(new Set([welcome, member, diploma]).size, 3);
  });

  it("rechaza un tipo de pieza desconocido", () => {
    assert.throws(
      () =>
        buildParticipantCardStorageKey({
          editionId: "ed_1",
          registrationId: "reg_1",
          templateVersion: 1,
          renderHash: "hash1",
          cardType: "certificado" as never,
        }),
      /UNKNOWN_CARD_TYPE/
    );
  });
});

describe("MemoryParticipantCardAssetStore", () => {
  it("putAtKey/get/exists/delete roundtrip", async () => {
    const store = new MemoryParticipantCardAssetStore();
    const key =
      "clickaton/participant-cards/edition-ed/reg-reg/welcome/v1/hash.png";
    const body = Buffer.from("png-bytes");
    assert.equal(await store.exists(key), false);
    const stored = await store.putAtKey(key, body, {
      cardType: "welcome",
      templateKey: "CLICKATON_WELCOME_STORY_V1",
      templateVersion: 1,
      renderHashPrefix: "abc123",
      width: 1080,
      height: 1920,
      mimeType: "image/png",
      generatedAt: new Date().toISOString(),
    });
    assert.equal(stored.key, key);
    assert.equal(stored.bytes, body.length);
    assert.equal(await store.exists(key), true);
    assert.equal((await store.get(key)).toString(), "png-bytes");
    await store.delete(key);
    assert.equal(await store.exists(key), false);
  });
});
