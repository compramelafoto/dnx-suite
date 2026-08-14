import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PARTNER_GLOBAL_STATUS_APPLICATIONS,
  assertPartnerGlobalStatusPayloadSafe,
  assertSafePartnersCentralAdminUrl,
  buildPartnerMetricsSummary,
  computePartnerGlobalHealth,
  computePartnerPlatformStatus,
  buildUnverifiablePlatformStatus,
  emptyCampaignCounts,
  emptySyncCounts,
  listPartnerGlobalPlacementsForApp,
  readPartnerGlobalFlagsForApp,
  resolveDnxPartnersCentralAdminUrl,
  resolvePartnerFlagDisplayState,
  FOTO_OFFICE_GLOBAL_STATUS_NOTE,
} from "./global-status";

describe("partner global status contract", () => {
  it("incluye cuatro plataformas y excluye FotoOffice", () => {
    assert.deepEqual([...PARTNER_GLOBAL_STATUS_APPLICATIONS], [
      "CLICKATON",
      "FOTO_RANK",
      "INFO_SPOT",
      "COMPRAME_LA_FOTO",
    ]);
    assert.ok(!(PARTNER_GLOBAL_STATUS_APPLICATIONS as readonly string[]).includes("FOTO_OFFICE"));
    const st = computePartnerPlatformStatus({
      application: "CLICKATON",
      source: "CENTRAL",
      schemaAvailable: true,
    });
    assert.equal(st.fotoOfficeNote, FOTO_OFFICE_GLOBAL_STATUS_NOTE);
  });

  it("flags ausentes = NO_CONFIGURADO; truthy = ON; otros = OFF", () => {
    assert.equal(resolvePartnerFlagDisplayState("MISSING", {}), "NO_CONFIGURADO");
    assert.equal(resolvePartnerFlagDisplayState("X", { X: "" }), "NO_CONFIGURADO");
    assert.equal(resolvePartnerFlagDisplayState("X", { X: "1" }), "ON");
    assert.equal(resolvePartnerFlagDisplayState("X", { X: "true" }), "ON");
    assert.equal(resolvePartnerFlagDisplayState("X", { X: "false" }), "OFF");
    assert.equal(resolvePartnerFlagDisplayState("X", { X: "maybe" }), "OFF");
  });

  it("payload y enlace central sin credenciales ni secretos", () => {
    assert.throws(() =>
      assertPartnerGlobalStatusPayloadSafe({ url: "postgresql://user:pass@host/db" }),
    );
    assert.throws(() =>
      assertPartnerGlobalStatusPayloadSafe({ env: "DATABASE_URL=postgres://x" }),
    );
    assert.equal(
      assertSafePartnersCentralAdminUrl(
        "https://maratonfotografica.com/admin/sponsors?token=secret&email=a@b.com",
      ).includes("token="),
      false,
    );
    assert.equal(
      assertSafePartnersCentralAdminUrl("http://evil.example/admin"),
      resolveDnxPartnersCentralAdminUrl(),
    );
    assert.match(resolveDnxPartnersCentralAdminUrl(), /^https:\/\//);
  });

  it("placements welcome y marquee clasificados por app", () => {
    const is = listPartnerGlobalPlacementsForApp("INFO_SPOT");
    assert.ok(
      is.some(
        (p) =>
          p.placementKey === "INFOSPOT_HOME_WELCOME" &&
          p.formatFamily === "WELCOME_INTERSTITIAL" &&
          p.mounted,
      ),
    );
    assert.ok(
      is.some(
        (p) =>
          p.placementKey === "INFOSPOT_HOME_MARQUEE" &&
          p.formatFamily === "LOGO_MARQUEE" &&
          p.mounted,
      ),
    );
    assert.ok(!is.some((p) => String(p.placementKey).includes("FOTOOFFICE")));

    const ck = listPartnerGlobalPlacementsForApp("CLICKATON");
    assert.ok(ck.some((p) => p.placementKey === "CLICKATON_EVENT_WELCOME"));
  });

  it("error de consulta ⇒ UNVERIFIABLE; campañas 0 verificadas ≠ fallo", () => {
    const bad = buildUnverifiablePlatformStatus("FOTO_RANK", "LOCAL_REPLICA", "timeout");
    assert.equal(bad.health, "UNVERIFIABLE");
    assert.equal(bad.campaigns.unverifiable, true);
    assert.equal(bad.campaigns.total, null);

    const zero = computePartnerGlobalHealth({
      flags: [{ key: "X", label: "X", state: "ON" }],
      campaigns: { ...emptyCampaignCounts(false), total: 0, active: 0, draft: 0, paused: 0, endedOrOther: 0 },
      sync: { ...emptySyncCounts(false), pending: 0, synced: 0, failed: 0 },
      schemaAvailable: true,
      queryFailed: false,
      loadError: null,
    });
    assert.equal(zero, "NO_CAMPAIGNS");
  });

  it("sync FAILED genera advertencia; HEALTHY solo con evidencia", () => {
    const failed = computePartnerPlatformStatus({
      application: "CLICKATON",
      source: "CENTRAL",
      schemaAvailable: true,
      env: { CLICKATON_PARTNER_WELCOME_ENABLED: "1" },
      campaigns: {
        total: 2,
        draft: 0,
        active: 2,
        paused: 0,
        endedOrOther: 0,
        unverifiable: false,
      },
      sync: { ...emptySyncCounts(false), failed: 3, pending: 0, synced: 1 },
    });
    assert.equal(failed.health, "SYNC_FAILED");
    assert.ok(failed.warnings.some((w) => /FAILED/i.test(w)));

    const flagsOff = computePartnerPlatformStatus({
      application: "FOTO_RANK",
      source: "LOCAL_REPLICA",
      schemaAvailable: true,
      campaigns: {
        total: 1,
        draft: 0,
        active: 1,
        paused: 0,
        endedOrOther: 0,
        unverifiable: false,
      },
      sync: { ...emptySyncCounts(false), failed: 0, pending: 0, synced: 0 },
    });
    assert.equal(flagsOff.health, "FLAGS_OFF");
    assert.notEqual(flagsOff.health, "HEALTHY");

    const healthy = computePartnerPlatformStatus({
      application: "CLICKATON",
      source: "CENTRAL",
      schemaAvailable: true,
      env: {
        CLICKATON_PARTNER_WELCOME_ENABLED: "1",
        CLICKATON_HOME_MARQUEE_ENABLED: "1",
      },
      campaigns: {
        total: 3,
        draft: 0,
        active: 2,
        paused: 1,
        endedOrOther: 0,
        unverifiable: false,
      },
      sync: { ...emptySyncCounts(false), failed: 0, pending: 0, synced: 2 },
    });
    assert.equal(healthy.health, "HEALTHY");
  });

  it("métricas ausentes no se inventan como cero", () => {
    const metrics = buildPartnerMetricsSummary({
      impressions: null,
      clicks: null,
      unverifiable: true,
    });
    assert.equal(metrics.impressions, null);
    assert.equal(metrics.clicks, null);

    const st = computePartnerPlatformStatus({
      application: "INFO_SPOT",
      source: "LOCAL_REPLICA",
      schemaAvailable: true,
      env: { INFOSPOT_PARTNER_ADS_ENABLED: "1" },
    });
    assert.equal(st.metrics.impressions, null);
    assert.equal(st.metrics.clicks, null);
    assert.match(st.metrics.note ?? "", /plataforma de destino|no verificable/i);
  });

  it("lectura de flags InfoSpot usa solo INFOSPOT_PARTNER_ADS_ENABLED", () => {
    const flags = readPartnerGlobalFlagsForApp("INFO_SPOT", {
      INFOSPOT_PARTNER_ADS_ENABLED: "true",
    } as NodeJS.ProcessEnv);
    assert.ok(flags.every((f) => f.key === "INFOSPOT_PARTNER_ADS_ENABLED"));
    assert.ok(flags.every((f) => f.state === "ON"));
    const missing = readPartnerGlobalFlagsForApp("INFO_SPOT", {} as NodeJS.ProcessEnv);
    assert.ok(missing.every((f) => f.state === "NO_CONFIGURADO"));
  });
});
