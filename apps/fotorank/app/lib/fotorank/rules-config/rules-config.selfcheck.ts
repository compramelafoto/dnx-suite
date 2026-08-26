/**
 * Selfcheck P0-09A — sin DB.
 * pnpm --filter fotorank run test:rules-config:selfcheck
 */
import assert from "node:assert/strict";
import { buildSantaFeEnFoco2026Configuration, SFEF_PRIZE_FIRST_MINOR } from "./santa-fe-en-foco-2026";
import { hashContestRulesConfiguration } from "./hash";
import { validateContestRulesConfiguration } from "./validate";
import {
  buildEntryUploadPolicy,
  buildMetadataPolicy,
  buildRegistrationPolicy,
  buildEditingPolicy,
  buildRightsPolicy,
} from "./policies";
import { buildChatGptRulesPrompt } from "./chatgpt-prompt";
import { compareRulesTextWithConfiguration } from "./compare-text";
import { buildProvincialContestTemplateConfiguration } from "./provincial-template";
import { buildContestRulesGenerationInput } from "./generation-input";
import { contestLocalToUtc } from "../timezone/contest-windows";

const config = buildSantaFeEnFoco2026Configuration();

// 1 hash estable
const h1 = hashContestRulesConfiguration(config);
const h2 = hashContestRulesConfiguration(structuredClone(config));
assert.equal(h1, h2);

// 3-4 fechas / límite exclusivo 1 oct
const closeEx = contestLocalToUtc("2026-10-01T00:00:00", "America/Argentina/Cordoba");
assert.equal(config.schedule.registrationClosesAtExclusive, closeEx.toISOString());
const lastInclusive = new Date(closeEx.getTime() - 1);
assert.ok(lastInclusive.getTime() < closeEx.getTime());
assert.ok(lastInclusive.getTime() >= Date.parse(config.schedule.registrationOpensAt));

// 5 FREE
assert.equal(config.participation.pricingMode, "FREE");
assert.equal(config.participation.priceAmountMinor, 0);

// 6-7 una categoría / una obra
assert.equal(config.participation.maxCategoriesPerRegistration, 1);
assert.equal(config.participation.maxEntriesPerRegistration, 1);

// 8-9 metadata recomendada / EXIF no bloquea
assert.equal(config.metadata.exifGeneral.level, "RECOMMENDED");
assert.notEqual(config.metadata.exifGeneral.missingAction, "REJECT");
const meta = buildMetadataPolicy(config);
assert.equal(meta.missingExifBlocksUpload, false);

// 10-12 edición
assert.equal(config.editing.exposure, "ALLOWED");
assert.equal(config.editing.radialMasks, "ALLOWED");
assert.equal(config.editing.photomontage, "PROHIBITED");

// 13-14 IA
assert.equal(config.ai.fullyGeneratedImage, "PROHIBITED");
assert.equal(config.ai.generativeFill, "PROHIBITED");
assert.equal(config.ai.aiNoiseReduction, "ALLOWED");

// 15-16 licencia
assert.equal(config.rights.licenseAppliesToAllWorks, true);
assert.equal(config.rights.durationMonths, 12);

// 17 premios
assert.equal(SFEF_PRIZE_FIRST_MINOR, 50_000_000);
assert.ok(config.prizes.some((p) => p.place === 1 && p.amountMinor === SFEF_PRIZE_FIRST_MINOR));

// 18 validación (menores/jurado cerrados en P0-09B → warnings legales, no pending human)
const validation = validateContestRulesConfiguration(config);
assert.ok(
  validation.status === "VALID_WITH_WARNINGS" || validation.status === "VALID",
  `expected VALID*, got ${validation.status}`,
);
assert.equal(config.participation.adultAuthorizationRequired, true);
assert.equal(config.jury.maxJudges, 12);
assert.equal(config.jury.judgesPendingHumanConfirmation, false);

// 19 contradicción texto
const conflictText = "El GPS será obligatorio. Participación gratuita. Una sola fotografía.";
const cmp = compareRulesTextWithConfiguration(conflictText, config);
assert.ok(cmp.some((c) => c.key === "gps" && c.status === "CONFLICT"));
assert.ok(cmp.some((c) => c.key === "free" && c.status === "MATCH"));

// 20 prompt sin secretos
const prompt = buildChatGptRulesPrompt(config);
assert.ok(prompt.includes("JSON DE CONFIGURACIÓN"));
assert.ok(!prompt.includes("password"));
assert.ok(!prompt.includes("storageKey"));

const gen = buildContestRulesGenerationInput(config);
assert.equal(gen.file.internalSafetyMaxFileSizeBytes, undefined);

// 21 plantilla sin datos específicos
const tpl = buildProvincialContestTemplateConfiguration();
assert.equal(tpl.identity.organizers.length, 0);
assert.equal(tpl.prizes.length, 0);
assert.ok(!tpl.identity.officialName.includes("Santa Fe en Foco 2026"));

// políticas derivadas
const reg = buildRegistrationPolicy(config);
assert.equal(reg.pricingMode, "FREE");
const upload = buildEntryUploadPolicy(config);
assert.equal(upload.maxFileSizeBytesRegulatory, null);
assert.ok((upload.maxFileSizeBytes ?? 0) > 0);
assert.equal(buildEditingPolicy(config).photomontage, "PROHIBITED");
assert.equal(buildRightsPolicy(config).licenseAppliesToAllWorks, true);

// categorías SF + participación abierta
assert.equal(config.participation.residencyRequired, false);
assert.equal(config.categories.length, 4);
assert.ok(config.categories.some((c) => c.slug === "fotografo-profesional" && c.deviceType === "CAMERA"));
assert.ok(config.categories.some((c) => c.slug === "fotografo-amateur" && c.deviceType === "OPEN"));
assert.ok(config.categories.some((c) => c.slug === "reportero-grafico" && c.membershipRestriction === "ARGRA"));
assert.ok(config.categories.some((c) => c.slug === "fotografia-aerea" && c.deviceType === "DRONE"));

console.log(
  JSON.stringify(
    {
      ok: true,
      hash: h1.slice(0, 12),
      validationStatus: validation.status,
      pendingCount: validation.findings.filter((f) => f.severity === "pending_human").length,
    },
    null,
    2,
  ),
);
console.log("rules-config.selfcheck.ts OK");
