import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  createSyntheticReadyCatalog,
  createSyntheticReadyProfile,
} from "../__fixtures__/synthetic-ready.js";
import { runPricingChecklist } from "../cli/run-pricing-checklist.js";
import { runPricingValidate } from "../cli/run-pricing-validate.js";
import { defaultProfileLocalPath, defaultTemplatesLocalPath } from "./paths.js";
import { loadPricingProfileFromPath } from "./load-pricing-profile.js";
import { loadServiceTemplatesFromPath } from "./load-service-templates.js";
import {
  summarizePricingConfiguration,
  summaryContainsMoneyLikeValues,
} from "./summarize-pricing-configuration.js";

describe("pricing config loaders y CLI", () => {
  it("archivo local inexistente → NOT_FOUND", () => {
    const result = loadPricingProfileFromPath(
      join(tmpdir(), "dnx-missing-profile-xyz.json"),
    );
    assert.equal(result.status, "NOT_FOUND");
  });

  it("JSON inválido → INVALID", () => {
    const dir = mkdtempSync(join(tmpdir(), "dnx-pricing-"));
    const path = join(dir, "bad.json");
    writeFileSync(path, "{not-json");
    const result = loadPricingProfileFromPath(path);
    assert.equal(result.status, "INVALID");
  });

  it("esquema inválido → INVALID", () => {
    const dir = mkdtempSync(join(tmpdir(), "dnx-pricing-"));
    const path = join(dir, "schema.json");
    writeFileSync(path, JSON.stringify({ id: "only" }));
    const result = loadPricingProfileFromPath(path);
    assert.equal(result.status, "INVALID");
  });

  it("configuración no lista → NOT_CONFIGURED", () => {
    const dir = mkdtempSync(join(tmpdir(), "dnx-pricing-"));
    const path = join(dir, "profile.json");
    writeFileSync(
      path,
      JSON.stringify(createSyntheticReadyProfile({ configured: false })),
    );
    const result = loadPricingProfileFromPath(path);
    assert.equal(result.status, "NOT_CONFIGURED");
  });

  it("configuración sintética lista → READY", () => {
    const dir = mkdtempSync(join(tmpdir(), "dnx-pricing-"));
    const profilePath = join(dir, "profile.json");
    const catalogPath = join(dir, "catalog.json");
    writeFileSync(profilePath, JSON.stringify(createSyntheticReadyProfile()));
    writeFileSync(catalogPath, JSON.stringify(createSyntheticReadyCatalog()));
    assert.equal(loadPricingProfileFromPath(profilePath).status, "READY");
    assert.equal(loadServiceTemplatesFromPath(catalogPath).status, "READY");
  });

  it("pricing:validate sin locales → exit ≠ 0 y sin montos", () => {
    const result = runPricingValidate({
      profilePath: defaultProfileLocalPath(),
      templatesPath: defaultTemplatesLocalPath(),
    });
    assert.notEqual(result.exitCode, 0);
    const text = result.lines.join("\n");
    assert.equal(summaryContainsMoneyLikeValues(text), false);
    assert.ok(text.includes("NO LISTO") || text.includes("no encontrado") || text.includes("NOT"));
  });

  it("pricing:validate con sintéticos listos → exit 0", () => {
    const dir = mkdtempSync(join(tmpdir(), "dnx-pricing-"));
    const profilePath = join(dir, "profile.json");
    const catalogPath = join(dir, "catalog.json");
    writeFileSync(profilePath, JSON.stringify(createSyntheticReadyProfile()));
    writeFileSync(catalogPath, JSON.stringify(createSyntheticReadyCatalog()));
    const result = runPricingValidate({ profilePath, templatesPath: catalogPath });
    assert.equal(result.exitCode, 0, result.lines.join("\n"));
  });

  it("resumen seguro no contiene montos", () => {
    const dir = mkdtempSync(join(tmpdir(), "dnx-pricing-"));
    const profilePath = join(dir, "profile.json");
    writeFileSync(profilePath, JSON.stringify(createSyntheticReadyProfile()));
    const profileLoad = loadPricingProfileFromPath(profilePath);
    const catalogLoad = loadServiceTemplatesFromPath(
      join(tmpdir(), "missing-catalog.json"),
    );
    const summary = summarizePricingConfiguration({ profileLoad, catalogLoad });
    const text = JSON.stringify(summary);
    assert.equal(text.includes("100000"), false);
    assert.equal(text.includes("500000"), false);
    assert.ok(summary.profileReady);
  });

  it("checklist contiene grupos y no propone números", () => {
    const result = runPricingChecklist();
    assert.equal(result.exitCode, 0);
    const text = result.lines.join("\n");
    assert.ok(text.includes("Perfil económico"));
    assert.ok(text.includes("WEDDING"));
    assert.ok(text.includes("FIFTEENTH_BIRTHDAY"));
    assert.ok(text.includes("gastos personales"));
    assert.ok(text.includes("dnx-pricing-profile.example.json"));
    assert.equal(/\b\d{4,}\b/.test(text.replace(/2026|1970/g, "")), false);
  });
});
