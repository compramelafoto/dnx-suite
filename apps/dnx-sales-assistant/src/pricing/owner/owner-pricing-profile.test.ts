import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  createOwnerFacingTestProfile,
  createSyntheticReadyCatalog,
  createSyntheticReadyProfile,
} from "../__fixtures__/synthetic-ready.js";
import { loadPricingProfileFromPath } from "../config/load-pricing-profile.js";
import {
  assertProductionSafePricingProfile,
  isExamplePricingPath,
  isUserFacingPricingProfile,
  SYNTHETIC_PROFILE_ID,
} from "../profile/user-facing-profile-guard.js";
import { buildOwnerProfileChecklist } from "./owner-profile-checklist.js";
import type { OwnerIdentityConfig } from "./owner-identity.js";
import { resolveOwnerPricingProfile } from "./resolve-owner-pricing-profile.js";

const ownerIdentity = (
  partial: Partial<OwnerIdentityConfig> = {},
): OwnerIdentityConfig => ({
  ownerEmail: "dnxfotografia@gmail.com",
  telegramOwnerUserId: "848105650",
  telegramOwnerChatId: "848105650",
  ...partial,
});

describe("user-facing pricing profile guard", () => {
  it("bloquea TEST_ONLY_SYNTHETIC_PROFILE y profileVersion test-", () => {
    const blocked = assertProductionSafePricingProfile({
      id: SYNTHETIC_PROFILE_ID,
      name: "x",
      profileVersion: "prod-1",
      configured: true,
    });
    assert.equal(blocked.ok, false);
    assert.equal(
      isUserFacingPricingProfile(
        createSyntheticReadyProfile({
          id: SYNTHETIC_PROFILE_ID,
          name: "TEST_ONLY_SYNTHETIC_PROFILE",
        }),
      ),
      false,
    );
    assert.equal(
      assertProductionSafePricingProfile(
        createSyntheticReadyProfile({ profileVersion: "test-1" }),
      ).ok,
      false,
    );
  });

  it("acepta perfil owner-facing de test", () => {
    assert.equal(
      assertProductionSafePricingProfile(createOwnerFacingTestProfile()).ok,
      true,
    );
  });

  it("detecta rutas .example.json", () => {
    assert.equal(
      isExamplePricingPath("config/pricing/owners/dnxfotografia.example.json"),
      true,
    );
    assert.equal(
      isExamplePricingPath("config/pricing/owners/dnxfotografia.local.json"),
      false,
    );
  });
});

describe("owner pricing profile resolver", () => {
  it("IDENTITY_MISMATCH con user ID incorrecto", () => {
    const r = resolveOwnerPricingProfile(
      {
        channel: "TELEGRAM",
        telegramUserId: "1",
        telegramChatId: "848105650",
      },
      ownerIdentity(),
    );
    assert.equal(r.status, "IDENTITY_MISMATCH");
  });

  it("IDENTITY_MISMATCH con chat ID incorrecto", () => {
    const r = resolveOwnerPricingProfile(
      {
        channel: "TELEGRAM",
        telegramUserId: "848105650",
        telegramChatId: "1",
      },
      ownerIdentity(),
    );
    assert.equal(r.status, "IDENTITY_MISMATCH");
  });

  it("IDENTITY_MISMATCH sin correo propietario", () => {
    const r = resolveOwnerPricingProfile(
      {
        channel: "TELEGRAM",
        telegramUserId: "848105650",
        telegramChatId: "848105650",
      },
      ownerIdentity({ ownerEmail: "" }),
    );
    assert.equal(r.status, "IDENTITY_MISMATCH");
  });

  it("NOT_FOUND sin archivo .local", () => {
    const r = resolveOwnerPricingProfile(
      {
        channel: "TELEGRAM",
        telegramUserId: "848105650",
        telegramChatId: "848105650",
      },
      ownerIdentity({
        profilePath: join(tmpdir(), "missing-owner-profile-xyz.local.json"),
        templatesPath: join(tmpdir(), "missing-templates-xyz.local.json"),
      }),
    );
    assert.equal(r.status, "NOT_FOUND");
  });

  it("no carga .example.json como real", () => {
    const example = join(
      process.cwd(),
      "config/pricing/owners/dnxfotografia.example.json",
    );
    const loaded = loadPricingProfileFromPath(example);
    assert.equal(loaded.status, "INVALID");
    const r = resolveOwnerPricingProfile(
      {
        channel: "TELEGRAM",
        telegramUserId: "848105650",
        telegramChatId: "848105650",
      },
      ownerIdentity({ profilePath: example }),
    );
    assert.notEqual(r.status, "READY");
  });

  it("READY con .local.json válido + plantillas", () => {
    const dir = mkdtempSync(join(tmpdir(), "dnx-owner-"));
    const profilePath = join(dir, "dnxfotografia.local.json");
    const templatesPath = join(dir, "templates.local.json");
    writeFileSync(profilePath, JSON.stringify(createOwnerFacingTestProfile()));
    writeFileSync(templatesPath, JSON.stringify(createSyntheticReadyCatalog()));
    const r = resolveOwnerPricingProfile(
      {
        channel: "TELEGRAM",
        telegramUserId: "848105650",
        telegramChatId: "848105650",
        ownerEmail: "dnxfotografia@gmail.com",
      },
      ownerIdentity({ profilePath, templatesPath }),
    );
    assert.equal(r.status, "READY");
    if (r.status === "READY") {
      assert.equal(r.source, "LOCAL_FILE");
      assert.notEqual(r.profile.id, SYNTHETIC_PROFILE_ID);
    }
  });

  it("SYNTHETIC_BLOCKED si el .local es sintético", () => {
    const dir = mkdtempSync(join(tmpdir(), "dnx-owner-synth-"));
    const profilePath = join(dir, "bad.local.json");
    const templatesPath = join(dir, "templates.local.json");
    writeFileSync(
      profilePath,
      JSON.stringify(
        createSyntheticReadyProfile({
          id: SYNTHETIC_PROFILE_ID,
          name: "TEST_ONLY_SYNTHETIC_PROFILE",
        }),
      ),
    );
    writeFileSync(templatesPath, JSON.stringify(createSyntheticReadyCatalog()));
    const r = resolveOwnerPricingProfile(
      {
        channel: "TELEGRAM",
        telegramUserId: "848105650",
        telegramChatId: "848105650",
      },
      ownerIdentity({ profilePath, templatesPath }),
    );
    assert.equal(r.status, "SYNTHETIC_BLOCKED");
  });

  it("INCOMPLETE con perfil no configurado", () => {
    const dir = mkdtempSync(join(tmpdir(), "dnx-owner-inc-"));
    const profilePath = join(dir, "incomplete.local.json");
    writeFileSync(
      profilePath,
      JSON.stringify(createOwnerFacingTestProfile({ configured: false })),
    );
    const r = resolveOwnerPricingProfile(
      {
        channel: "TELEGRAM",
        telegramUserId: "848105650",
        telegramChatId: "848105650",
      },
      ownerIdentity({
        profilePath,
        templatesPath: join(dir, "missing-templates.local.json"),
      }),
    );
    assert.ok(r.status === "INCOMPLETE" || r.status === "NOT_FOUND");
  });
});

describe("owner-profile checklist", () => {
  it("checklist sin identidad → veredicto C", () => {
    const result = buildOwnerProfileChecklist({
      DNX_OWNER_EMAIL: "",
      DNX_TELEGRAM_OWNER_USER_ID: "",
      DNX_TELEGRAM_OWNER_CHAT_ID: "",
    });
    assert.equal(result.verdict, "C");
    assert.notEqual(result.exitCode, 0);
    assert.match(result.lines.join("\n"), /NO CONFIGURADO|FALTA/i);
  });
});
