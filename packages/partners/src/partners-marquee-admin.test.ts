import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AD_PLACEMENT_CATALOG, CREATIVE_FORMAT_LABELS } from "./campaigns";
import {
  LOGO_MARQUEE_PLACEMENT_KEYS,
  MOUNTED_LOGO_MARQUEE_PLACEMENT_KEYS,
  UNMOUNTED_LOGO_MARQUEE_PLACEMENT_KEYS,
  assertLogoMarqueeBindingAllowed,
  assertLogoMarqueePlacementPublishable,
  assertLogoMarqueeScopeConfig,
  isLogoMarqueePlacementKey,
  listLogoMarqueePlacementMatrix,
  listLogoMarqueePlacementsForAdminUi,
  listSelectableLogoMarqueePlacementsForAdmin,
  marqueeAdminCatalogMeta,
} from "./marquee-admin";
import { PartnersDomainError } from "./types";

describe("logo marquee catalog", () => {
  it("incluye 4 placements CK/FR nuevos y preserva IS/CLF", () => {
    for (const key of [
      "CLICKATON_HOME_MARQUEE",
      "CLICKATON_EVENT_MARQUEE",
      "FOTORANK_HOME_MARQUEE",
      "FOTORANK_CONTEST_MARQUEE",
      "INFOSPOT_HOME_MARQUEE",
      "CLF_LOGO_MARQUEE",
    ] as const) {
      assert.ok(
        AD_PLACEMENT_CATALOG.some((e) => e.placementKey === key),
        key,
      );
      assert.ok(isLogoMarqueePlacementKey(key));
    }
    assert.equal(LOGO_MARQUEE_PLACEMENT_KEYS.length, 6);
    const keys = AD_PLACEMENT_CATALOG.map((e) => `${e.application}:${e.placementKey}`);
    assert.equal(keys.length, new Set(keys).size);
    assert.ok(!AD_PLACEMENT_CATALOG.some((e) => String(e.placementKey) === "CLF_HOME_MARQUEE"));
    assert.ok(!AD_PLACEMENT_CATALOG.some((e) => e.application === "FOTO_OFFICE"));
  });

  it("admite LOGO_MARQUEE y no duplica el enum", () => {
    for (const key of LOGO_MARQUEE_PLACEMENT_KEYS) {
      const entry = AD_PLACEMENT_CATALOG.find((e) => e.placementKey === key)!;
      assert.ok(entry.allowedFormats.includes("LOGO_MARQUEE"));
      assert.equal(entry.trackingPlacement, "LOGO_MARQUEE");
      assert.equal(entry.rotationMode, "MARQUEE");
    }
    assert.equal(CREATIVE_FORMAT_LABELS.LOGO_MARQUEE, "Slider de marcas");
  });

  it("matriz montado/no montado correcta", () => {
    const matrix = listLogoMarqueePlacementMatrix();
    for (const key of MOUNTED_LOGO_MARQUEE_PLACEMENT_KEYS) {
      const row = matrix.find((r) => r.placementKey === key)!;
      assert.equal(row.mounted, true);
      assert.equal(row.publishable, true);
    }
    for (const key of UNMOUNTED_LOGO_MARQUEE_PLACEMENT_KEYS) {
      const row = matrix.find((r) => r.placementKey === key)!;
      assert.equal(row.mounted, false);
      assert.equal(row.publishable, false);
    }
  });
});

describe("logo marquee admin UI", () => {
  it("copy Slider de marcas + Disponible/Próximamente; FotoOffice ausente", () => {
    const meta = marqueeAdminCatalogMeta();
    assert.equal(meta.format, "LOGO_MARQUEE");
    assert.equal(meta.formatLabel, "Slider de marcas");
    assert.match(meta.formatDescription, /Franja continua/i);

    const all = listLogoMarqueePlacementsForAdminUi();
    assert.ok(all.every((p) => (p.application as string) !== "FOTO_OFFICE"));
    for (const p of all) {
      if (p.mounted) {
        assert.equal(p.availabilityLabel, "Disponible");
        assert.equal(p.selectable, true);
      } else {
        assert.equal(p.availabilityLabel, "Próximamente");
        assert.equal(p.selectable, false);
        assert.match(p.disabledReason ?? "", /todavía no habilitada/i);
      }
    }
    const selectable = listSelectableLogoMarqueePlacementsForAdmin();
    assert.deepEqual(
      selectable.map((p) => p.placementKey).sort(),
      [...MOUNTED_LOGO_MARQUEE_PLACEMENT_KEYS].sort(),
    );
  });
});

describe("logo marquee validation", () => {
  it("permite IS/CLF/CK/FR montados; rechaza FotoOffice", () => {
    assert.doesNotThrow(() =>
      assertLogoMarqueePlacementPublishable("INFO_SPOT", "INFOSPOT_HOME_MARQUEE"),
    );
    assert.doesNotThrow(() =>
      assertLogoMarqueePlacementPublishable("COMPRAME_LA_FOTO", "CLF_LOGO_MARQUEE"),
    );
    assert.doesNotThrow(() =>
      assertLogoMarqueePlacementPublishable("CLICKATON", "CLICKATON_HOME_MARQUEE"),
    );
    assert.doesNotThrow(() =>
      assertLogoMarqueePlacementPublishable("FOTO_RANK", "FOTORANK_HOME_MARQUEE"),
    );
    assert.doesNotThrow(() =>
      assertLogoMarqueePlacementPublishable("FOTO_RANK", "FOTORANK_CONTEST_MARQUEE"),
    );
    assert.throws(
      () => assertLogoMarqueePlacementPublishable("FOTO_OFFICE", "INFOSPOT_HOME_MARQUEE"),
      PartnersDomainError,
    );
    assert.throws(
      () => assertLogoMarqueePlacementPublishable("CLICKATON", "INFOSPOT_HOME_MARQUEE"),
      PartnersDomainError,
    );
  });

  it("rechaza alcance/contexto incorrecto y huérfanas", () => {
    assert.doesNotThrow(() =>
      assertLogoMarqueeScopeConfig({
        placementKey: "INFOSPOT_HOME_MARQUEE",
        scopeKind: "GLOBAL",
      }),
    );
    assert.doesNotThrow(() =>
      assertLogoMarqueeScopeConfig({
        placementKey: "FOTORANK_CONTEST_MARQUEE",
        scopeKind: "GLOBAL",
      }),
    );
    assert.doesNotThrow(() =>
      assertLogoMarqueeScopeConfig({
        placementKey: "FOTORANK_CONTEST_MARQUEE",
        scopeKind: "CONTEST",
        contextId: "contest_abc",
      }),
    );
    assert.throws(
      () =>
        assertLogoMarqueeScopeConfig({
          placementKey: "CLICKATON_EVENT_MARQUEE",
          scopeKind: "GLOBAL",
        }),
      PartnersDomainError,
    );
    assert.throws(
      () =>
        assertLogoMarqueeScopeConfig({
          placementKey: "FOTORANK_CONTEST_MARQUEE",
          scopeKind: "CONTEST",
          contextId: "",
        }),
      PartnersDomainError,
    );
    assert.throws(
      () =>
        assertLogoMarqueeBindingAllowed({
          application: "INFO_SPOT",
          placementKey: "INFOSPOT_HOME_MARQUEE",
          requireExplicitParticipation: true,
          participationContextType: null,
        }),
      PartnersDomainError,
    );
  });
});
