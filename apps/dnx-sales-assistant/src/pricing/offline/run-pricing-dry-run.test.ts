import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import {
  createSyntheticReadyCatalog,
  createSyntheticReadyProfile,
  createSyntheticReadyWeddingTemplate,
} from "../__fixtures__/synthetic-ready.js";
import { PricingIssueCode } from "../issue-codes.js";
import { runPricingDryRun } from "./run-pricing-dry-run.js";
import { runPricingDryRunCli } from "../cli/run-pricing-dry-run.js";
import { defaultJobLocalPath } from "../config/paths.js";

describe("runPricingDryRun — orquestador offline", () => {
  it("configuración sintética completa → READY (motor real)", async () => {
    const result = await runPricingDryRun({
      inline: {
        profile: createSyntheticReadyProfile(),
        catalog: createSyntheticReadyCatalog(),
        draft: {
          serviceType: "WEDDING",
          eventDate: "2026-09-20",
          city: "Córdoba",
          durationHours: 8,
        },
      },
    });
    assert.equal(result.exitCode, 0);
    assert.equal(result.stage, "complete");
    assert.equal(result.calculation?.status, "READY");
    if (result.calculation?.status !== "READY") return;
    assert.equal(result.calculation.currency, "ARS");
    assert.ok(result.calculation.minimumSustainablePrice > 0);
    assert.ok(
      result.calculation.recommendedBusinessPrice >=
        result.calculation.minimumSustainablePrice,
    );
    assert.equal(result.calculation.approvalStatus, "NOT_REVIEWED");
    assert.equal(result.calculation.profileVersion, "test-1");
    assert.ok(result.lines.some((l) => l.startsWith("Estado: READY")));
  });

  it("quince / producto / deporte sintéticos → READY", async () => {
    for (const draft of [
      {
        serviceType: "FIFTEENTH_BIRTHDAY" as const,
        durationHours: 6,
        city: "Rosario",
        eventDate: "2026-10-01",
      },
      {
        serviceType: "PRODUCT_PHOTOGRAPHY" as const,
        durationHours: 2,
        city: "Córdoba",
        eventDate: "2026-11-01",
      },
      {
        serviceType: "SPORTS_EVENT" as const,
        durationHours: 4,
        city: "Mendoza",
        eventDate: "2026-12-01",
      },
    ]) {
      const result = await runPricingDryRun({
        inline: {
          profile: createSyntheticReadyProfile(),
          catalog: createSyntheticReadyCatalog(),
          draft,
        },
      });
      assert.equal(result.exitCode, 0, draft.serviceType);
      assert.equal(result.calculation?.status, "READY", draft.serviceType);
    }
  });

  it("perfil ausente / catálogo ausente / job ausente", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "dnx-dry-"));
    try {
      const missing = path.join(dir, "missing.json");
      const r1 = await runPricingDryRun({
        profilePath: missing,
        templatesPath: missing,
        jobPath: missing,
      });
      assert.equal(r1.exitCode, 1);
      assert.equal(r1.stage, "profile");
      assert.ok(r1.issues.some((i) => i.code === PricingIssueCode.FILE_NOT_FOUND));
      assert.equal(r1.lines.join("\n").includes("Mínimo sostenible:"), false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("JSON inválido en job", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "dnx-dry-"));
    try {
      const profile = path.join(dir, "p.json");
      const templates = path.join(dir, "t.json");
      const job = path.join(dir, "j.json");
      writeFileSync(profile, JSON.stringify(createSyntheticReadyProfile()));
      writeFileSync(templates, JSON.stringify(createSyntheticReadyCatalog()));
      writeFileSync(job, "{not-json");
      const result = await runPricingDryRun({
        profilePath: profile,
        templatesPath: templates,
        jobPath: job,
      });
      assert.equal(result.exitCode, 1);
      assert.equal(result.stage, "job");
      assert.ok(result.issues.some((i) => i.code === PricingIssueCode.JSON_INVALID));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("perfil / catálogo / job no configurados", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "dnx-dry-"));
    try {
      const profile = path.join(dir, "p.json");
      const templates = path.join(dir, "t.json");
      const job = path.join(dir, "j.json");
      writeFileSync(
        profile,
        JSON.stringify({ ...createSyntheticReadyProfile(), configured: false }),
      );
      writeFileSync(templates, JSON.stringify(createSyntheticReadyCatalog()));
      writeFileSync(
        job,
        JSON.stringify({
          configured: true,
          serviceType: "WEDDING",
          durationHours: 8,
          city: "X",
          eventDate: "2026-09-20",
        }),
      );
      const rProfile = await runPricingDryRun({
        profilePath: profile,
        templatesPath: templates,
        jobPath: job,
      });
      assert.equal(rProfile.exitCode, 1);
      assert.equal(rProfile.stage, "profile");

      writeFileSync(profile, JSON.stringify(createSyntheticReadyProfile()));
      writeFileSync(
        templates,
        JSON.stringify({
          ...createSyntheticReadyCatalog(),
          configured: false,
          templates: [
            { ...createSyntheticReadyWeddingTemplate(), configured: false },
          ],
        }),
      );
      const rCat = await runPricingDryRun({
        profilePath: profile,
        templatesPath: templates,
        jobPath: job,
      });
      assert.equal(rCat.exitCode, 1);
      assert.equal(rCat.stage, "catalog");

      writeFileSync(templates, JSON.stringify(createSyntheticReadyCatalog()));
      writeFileSync(
        job,
        JSON.stringify({
          configured: false,
          serviceType: "WEDDING",
          durationHours: 8,
        }),
      );
      const rJob = await runPricingDryRun({
        profilePath: profile,
        templatesPath: templates,
        jobPath: job,
      });
      assert.equal(rJob.exitCode, 1);
      assert.equal(rJob.stage, "job");
      assert.ok(rJob.issues.some((i) => i.code === PricingIssueCode.JOB_NOT_CONFIGURED));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("servicio sin plantilla / duración fuera de rango", async () => {
    const noSportsCatalog = {
      ...createSyntheticReadyCatalog(),
      templates: [createSyntheticReadyWeddingTemplate()],
    };
    const r1 = await runPricingDryRun({
      inline: {
        profile: createSyntheticReadyProfile(),
        catalog: noSportsCatalog,
        draft: { serviceType: "SPORTS_EVENT", durationHours: 4 },
      },
    });
    assert.equal(r1.exitCode, 1);
    assert.equal(r1.stage, "prepare");

    const r2 = await runPricingDryRun({
      inline: {
        profile: createSyntheticReadyProfile(),
        catalog: createSyntheticReadyCatalog(),
        draft: { serviceType: "WEDDING", durationHours: 1 },
      },
    });
    assert.equal(r2.exitCode, 1);
    assert.equal(r2.stage, "prepare");
  });

  it("versiones incompatibles → adapter falla", async () => {
    const result = await runPricingDryRun({
      inline: {
        profile: createSyntheticReadyProfile({
          formulaVersion: "other-formula",
        }),
        catalog: createSyntheticReadyCatalog(),
        draft: {
          serviceType: "WEDDING",
          durationHours: 8,
          eventDate: "2026-09-20",
          city: "Córdoba",
        },
      },
    });
    assert.equal(result.exitCode, 1);
    assert.equal(result.stage, "adapter");
  });

  it("no escribe archivos", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "dnx-dry-empty-"));
    try {
      const before = readdirSync(dir);
      await runPricingDryRun({
        profilePath: path.join(dir, "a.json"),
        templatesPath: path.join(dir, "b.json"),
        jobPath: path.join(dir, "c.json"),
      });
      assert.deepEqual(readdirSync(dir), before);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("CLI default sin locales → exit ≠ 0 sin montos", async () => {
    const cli = await runPricingDryRunCli({
      profilePath: defaultJobLocalPath() + ".missing-profile",
      templatesPath: defaultJobLocalPath() + ".missing-templates",
      jobPath: defaultJobLocalPath() + ".missing-job",
    });
    assert.notEqual(cli.exitCode, 0);
    const text = cli.lines.join("\n");
    assert.equal(text.includes("Mínimo sostenible:"), false);
    assert.equal(text.includes("stack"), false);
  });
});
