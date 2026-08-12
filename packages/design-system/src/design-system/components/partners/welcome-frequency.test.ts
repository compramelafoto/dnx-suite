import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildLegacyPartnerWelcomeFrequencyStorageKey,
  buildPartnerWelcomeFrequencyStorageKey,
  markPartnerWelcomeShown,
  readPartnerWelcomeFrequency,
  type PartnerWelcomeFrequencyStore,
} from "./welcome-frequency";

function memoryStore(initial: Record<string, string> = {}): PartnerWelcomeFrequencyStore & {
  data: Record<string, string>;
} {
  const data = { ...initial };
  return {
    data,
    getItem(key: string) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key]! : null;
    },
    setItem(key: string, value: string) {
      data[key] = value;
    },
  };
}

describe("partner welcome frequency", () => {
  it("clave incluye versión, campaña y placement", () => {
    const key = buildPartnerWelcomeFrequencyStorageKey({
      campaignId: "camp-1",
      placementKey: "INFOSPOT_HOME_WELCOME",
    });
    assert.match(key, /^dnx_partner_welcome_v1:camp-1:INFOSPOT_HOME_WELCOME$/);
    assert.notEqual(
      key,
      buildPartnerWelcomeFrequencyStorageKey({
        campaignId: "camp-1",
        placementKey: "CLF_HOME_WELCOME",
      }),
    );
    assert.notEqual(
      key,
      buildPartnerWelcomeFrequencyStorageKey({
        campaignId: "camp-2",
        placementKey: "INFOSPOT_HOME_WELCOME",
      }),
    );
  });

  it("primera aparición permitida; segunda dentro de 24h bloqueada", () => {
    const store = memoryStore();
    const t0 = Date.parse("2026-08-12T12:00:00Z");
    assert.equal(
      readPartnerWelcomeFrequency({
        campaignId: "c1",
        placementKey: "INFOSPOT_HOME_WELCOME",
        nowMs: t0,
        store,
      }).allowed,
      true,
    );
    markPartnerWelcomeShown({
      campaignId: "c1",
      placementKey: "INFOSPOT_HOME_WELCOME",
      nowMs: t0,
      store,
    });
    assert.equal(
      readPartnerWelcomeFrequency({
        campaignId: "c1",
        placementKey: "INFOSPOT_HOME_WELCOME",
        nowMs: t0 + 60 * 60 * 1000,
        store,
      }).allowed,
      false,
    );
    assert.equal(
      readPartnerWelcomeFrequency({
        campaignId: "c1",
        placementKey: "INFOSPOT_HOME_WELCOME",
        nowMs: t0 + 25 * 60 * 60 * 1000,
        store,
      }).allowed,
      true,
    );
  });

  it("separa por campaña y placement", () => {
    const store = memoryStore();
    const t0 = Date.now();
    markPartnerWelcomeShown({
      campaignId: "c1",
      placementKey: "INFOSPOT_HOME_WELCOME",
      nowMs: t0,
      store,
    });
    assert.equal(
      readPartnerWelcomeFrequency({
        campaignId: "c2",
        placementKey: "INFOSPOT_HOME_WELCOME",
        nowMs: t0,
        store,
      }).allowed,
      true,
    );
    assert.equal(
      readPartnerWelcomeFrequency({
        campaignId: "c1",
        placementKey: "CLF_HOME_WELCOME",
        nowMs: t0,
        store,
      }).allowed,
      true,
    );
  });

  it("tolera storage corrupto y ausente", () => {
    const store = memoryStore({
      [buildPartnerWelcomeFrequencyStorageKey({
        campaignId: "c1",
        placementKey: "INFOSPOT_HOME_WELCOME",
      })]: "not-a-number",
    });
    assert.equal(
      readPartnerWelcomeFrequency({
        campaignId: "c1",
        placementKey: "INFOSPOT_HOME_WELCOME",
        store,
      }).allowed,
      true,
    );
    assert.equal(
      readPartnerWelcomeFrequency({
        campaignId: "c1",
        placementKey: "INFOSPOT_HOME_WELCOME",
        store: null,
      }).allowed,
      true,
    );
  });

  it("respeta clave legacy InfoSpot", () => {
    const campaignId = "legacy-camp";
    const store = memoryStore({
      [buildLegacyPartnerWelcomeFrequencyStorageKey(campaignId)]: String(Date.now()),
    });
    assert.equal(
      readPartnerWelcomeFrequency({
        campaignId,
        placementKey: "INFOSPOT_HOME_WELCOME",
        store,
      }).allowed,
      false,
    );
  });

  it("disableFrequencyCap permite siempre y no escribe", () => {
    const store = memoryStore();
    markPartnerWelcomeShown({
      campaignId: "c1",
      placementKey: "INFOSPOT_HOME_WELCOME",
      store,
      disableFrequencyCap: true,
    });
    assert.equal(Object.keys(store.data).length, 0);
    assert.equal(
      readPartnerWelcomeFrequency({
        campaignId: "c1",
        placementKey: "INFOSPOT_HOME_WELCOME",
        store,
        disableFrequencyCap: true,
      }).allowed,
      true,
    );
  });

  it("SSR-safe: store null no lanza", () => {
    assert.doesNotThrow(() =>
      readPartnerWelcomeFrequency({
        campaignId: "c1",
        placementKey: "INFOSPOT_HOME_WELCOME",
        store: null,
      }),
    );
    assert.doesNotThrow(() =>
      markPartnerWelcomeShown({
        campaignId: "c1",
        placementKey: "INFOSPOT_HOME_WELCOME",
        store: null,
      }),
    );
  });
});
