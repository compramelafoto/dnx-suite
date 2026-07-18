import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { defaultProfileExamplePath } from "../config/paths.js";
import { createSyntheticReadyProfile } from "../__fixtures__/synthetic-ready.js";
import { PricingIssueCode } from "../issue-codes.js";
import { pricingProfileSchema } from "./profile-schema.js";
import { validatePricingProfileReadiness } from "./profile-readiness.js";

describe("pricing profile readiness", () => {
  it("example es estructuralmente válido y no listo", () => {
    const raw = JSON.parse(readFileSync(defaultProfileExamplePath(), "utf8"));
    const parsed = pricingProfileSchema.safeParse(raw);
    assert.equal(parsed.success, true);
    if (!parsed.success) return;
    const readiness = validatePricingProfileReadiness(parsed.data);
    assert.equal(readiness.ready, false);
    assert.equal(readiness.configured, false);
    assert.ok(
      readiness.errors.some((e) => e.code === PricingIssueCode.PROFILE_NOT_CONFIGURED),
    );
  });

  it("configured false", () => {
    const readiness = validatePricingProfileReadiness(
      createSyntheticReadyProfile({ configured: false }),
    );
    assert.equal(readiness.ready, false);
    assert.ok(
      readiness.errors.some((e) => e.code === PricingIssueCode.PROFILE_NOT_CONFIGURED),
    );
  });

  it("versión unconfigured", () => {
    const readiness = validatePricingProfileReadiness(
      createSyntheticReadyProfile({ profileVersion: "unconfigured" }),
    );
    assert.ok(
      readiness.errors.some((e) => e.code === PricingIssueCode.PROFILE_VERSION_MISSING),
    );
  });

  it("moneda ausente", () => {
    const readiness = validatePricingProfileReadiness(
      createSyntheticReadyProfile({ currency: "" }),
    );
    assert.ok(readiness.errors.some((e) => e.code === PricingIssueCode.CURRENCY_MISSING));
  });

  it("posicionamiento ausente", () => {
    const readiness = validatePricingProfileReadiness(
      createSyntheticReadyProfile({ commercialPositioningId: "" }),
    );
    assert.ok(
      readiness.errors.some(
        (e) => e.code === PricingIssueCode.COMMERCIAL_POSITIONING_MISSING,
      ),
    );
  });

  it("gastos personales vacíos", () => {
    const readiness = validatePricingProfileReadiness(
      createSyntheticReadyProfile({ personalExpenses: [] }),
    );
    assert.ok(
      readiness.errors.some((e) => e.code === PricingIssueCode.PERSONAL_EXPENSES_EMPTY),
    );
  });

  it("horas semanales cero", () => {
    const base = createSyntheticReadyProfile();
    const readiness = validatePricingProfileReadiness({
      ...base,
      availability: { ...base.availability, weeklyHours: 0, billableHoursWeekly: 0 },
    });
    assert.ok(
      readiness.errors.some((e) => e.code === PricingIssueCode.WEEKLY_HOURS_INVALID),
    );
  });

  it("horas facturables cero", () => {
    const base = createSyntheticReadyProfile();
    const readiness = validatePricingProfileReadiness({
      ...base,
      availability: {
        ...base.availability,
        billableHoursWeekly: 0,
        timeDistribution: {
          coverage: 0,
          editing: 40,
          administration: 20,
          sales: 20,
          marketing: 10,
          training: 10,
        },
      },
    });
    assert.ok(
      readiness.errors.some((e) => e.code === PricingIssueCode.BILLABLE_HOURS_INVALID),
    );
  });

  it("horas facturables mayores al total", () => {
    const base = createSyntheticReadyProfile();
    const readiness = validatePricingProfileReadiness({
      ...base,
      availability: { ...base.availability, weeklyHours: 10, billableHoursWeekly: 40 },
    });
    assert.ok(
      readiness.errors.some((e) => e.code === PricingIssueCode.BILLABLE_HOURS_INVALID),
    );
  });

  it("valores negativos", () => {
    const readiness = validatePricingProfileReadiness(
      createSyntheticReadyProfile({
        income: { livesOnlyFromPhotography: "yes", externalMonthlyIncome: -1 },
      }),
    );
    assert.ok(readiness.errors.some((e) => e.code === PricingIssueCode.NEGATIVE_VALUE));
  });

  it("perfil sintético listo", () => {
    const readiness = validatePricingProfileReadiness(createSyntheticReadyProfile());
    assert.equal(readiness.ready, true);
    assert.equal(readiness.errors.length, 0);
  });

  it("esquema inválido", () => {
    const readiness = validatePricingProfileReadiness({
      id: "x",
    } as never);
    assert.equal(readiness.ready, false);
    assert.ok(readiness.errors.some((e) => e.code === PricingIssueCode.SCHEMA_INVALID));
  });
});
