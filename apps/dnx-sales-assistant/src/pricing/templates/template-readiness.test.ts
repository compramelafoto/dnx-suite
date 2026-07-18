import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { defaultTemplatesExamplePath } from "../config/paths.js";
import {
  createSyntheticReadyCatalog,
  createSyntheticReadyWeddingTemplate,
} from "../__fixtures__/synthetic-ready.js";
import { PricingIssueCode } from "../issue-codes.js";
import {
  validateServiceTemplateReadiness,
  validateTemplateCatalogReadiness,
} from "./template-readiness.js";
import { pricingServiceTemplateCatalogSchema } from "./template-schema.js";

describe("pricing service templates readiness", () => {
  it("catálogo example válido estructuralmente y no listo", () => {
    const raw = JSON.parse(readFileSync(defaultTemplatesExamplePath(), "utf8"));
    const parsed = pricingServiceTemplateCatalogSchema.safeParse(raw);
    assert.equal(parsed.success, true);
    if (!parsed.success) return;
    assert.equal(parsed.data.templates.length, 11);
    const readiness = validateTemplateCatalogReadiness(
      parsed.data as import("../models.js").PricingServiceTemplateCatalog,
    );
    assert.equal(readiness.ready, false);
  });

  it("servicios duplicados", () => {
    const catalog = createSyntheticReadyCatalog();
    catalog.templates.push(createSyntheticReadyWeddingTemplate({ id: "dup" }));
    const readiness = validateTemplateCatalogReadiness(catalog);
    assert.ok(
      readiness.errors.some((e) => e.code === PricingIssueCode.TEMPLATE_DUPLICATE_SERVICE),
    );
  });

  it("IDs de plantilla duplicados", () => {
    const catalog = createSyntheticReadyCatalog();
    const first = catalog.templates[0];
    const second = catalog.templates[1];
    assert.ok(first && second);
    catalog.templates[1] = {
      ...second,
      id: first.id,
      serviceType: "BIRTHDAY",
    };
    const readiness = validateTemplateCatalogReadiness(catalog);
    assert.ok(
      readiness.errors.some((e) => e.code === PricingIssueCode.TEMPLATE_DUPLICATE_ID),
    );
  });

  it("template sin configurar", () => {
    const readiness = validateServiceTemplateReadiness(
      createSyntheticReadyWeddingTemplate({ configured: false }),
    );
    assert.equal(readiness.ready, false);
    assert.ok(
      readiness.errors.some((e) => e.code === PricingIssueCode.TEMPLATE_NOT_CONFIGURED),
    );
  });

  it("versión ausente/unconfigured", () => {
    const readiness = validateServiceTemplateReadiness(
      createSyntheticReadyWeddingTemplate({ templateVersion: "unconfigured" }),
    );
    assert.ok(
      readiness.errors.some((e) => e.code === PricingIssueCode.TEMPLATE_VERSION_MISSING),
    );
  });

  it("rango inválido", () => {
    const readiness = validateServiceTemplateReadiness(
      createSyntheticReadyWeddingTemplate({
        coverage: { minimumHours: 10, maximumHours: 4 },
      }),
    );
    assert.ok(
      readiness.errors.some(
        (e) => e.code === PricingIssueCode.TEMPLATE_COVERAGE_RANGE_INVALID,
      ),
    );
  });

  it("edición fixed sin horas", () => {
    const readiness = validateServiceTemplateReadiness(
      createSyntheticReadyWeddingTemplate({
        editing: { mode: "FIXED_HOURS" },
      }),
    );
    assert.ok(
      readiness.errors.some(
        (e) => e.code === PricingIssueCode.TEMPLATE_EDITING_FIXED_HOURS_MISSING,
      ),
    );
  });

  it("multiplicador ausente", () => {
    const readiness = validateServiceTemplateReadiness(
      createSyntheticReadyWeddingTemplate({
        editing: { mode: "HOURS_PER_COVERAGE_HOUR" },
      }),
    );
    assert.ok(
      readiness.errors.some(
        (e) => e.code === PricingIssueCode.TEMPLATE_EDITING_MULTIPLIER_MISSING,
      ),
    );
  });

  it("MANUAL bloquea automatización", () => {
    const readiness = validateServiceTemplateReadiness(
      createSyntheticReadyWeddingTemplate({
        editing: { mode: "MANUAL" },
      }),
    );
    assert.ok(
      readiness.errors.some((e) => e.code === PricingIssueCode.TEMPLATE_EDITING_MANUAL),
    );
  });

  it("concepto incompleto", () => {
    const readiness = validateServiceTemplateReadiness(
      createSyntheticReadyWeddingTemplate({
        concepts: [
          {
            id: "c1",
            configured: true,
            type: "OWN_SERVICE",
            label: "X",
            calculationMode: "FIXED",
          },
        ],
      }),
    );
    assert.ok(
      readiness.errors.some((e) => e.code === PricingIssueCode.TEMPLATE_CONCEPT_INCOMPLETE),
    );
  });

  it("margen negativo", () => {
    const readiness = validateServiceTemplateReadiness(
      createSyntheticReadyWeddingTemplate({
        concepts: [
          {
            id: "c1",
            configured: true,
            type: "OWN_SERVICE",
            label: "X",
            calculationMode: "FIXED",
            hours: 2,
            marginPercent: -5,
          },
        ],
      }),
    );
    assert.ok(
      readiness.errors.some((e) => e.code === PricingIssueCode.TEMPLATE_MARGIN_NEGATIVE),
    );
  });

  it("valores negativos en horas generales", () => {
    const readiness = validateServiceTemplateReadiness(
      createSyntheticReadyWeddingTemplate({
        generalClientHours: {
          sales: -1,
          meetings: 0,
          preparation: 0,
          coordination: 0,
          billing: 0,
          followUp: 0,
          deliveryAdministration: 0,
        },
      }),
    );
    assert.ok(readiness.errors.some((e) => e.code === PricingIssueCode.NEGATIVE_VALUE));
  });

  it("catálogo sintético listo", () => {
    const readiness = validateTemplateCatalogReadiness(createSyntheticReadyCatalog());
    assert.equal(readiness.ready, true, JSON.stringify(readiness.errors, null, 2));
  });
});
