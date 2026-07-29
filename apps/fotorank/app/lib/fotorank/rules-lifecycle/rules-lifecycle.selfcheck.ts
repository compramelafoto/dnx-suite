/**
 * Selfcheck P0-09B — sin DB.
 * pnpm --filter fotorank run test:rules-lifecycle:selfcheck
 */
import assert from "node:assert/strict";
import { buildSantaFeEnFoco2026Configuration } from "../rules-config/santa-fe-en-foco-2026";
import { buildChatGptRulesPrompt } from "../rules-config/chatgpt-prompt";
import { hashContestRulesConfiguration } from "../rules-config/hash";
import { normalizeContestRulesDocument, sanitizeRulesHtml } from "./normalize-document";
import { parseExternalRulesAiResponse } from "./structured-import";
import { compareRulesTextWithConfiguration, hasBlockingConflicts } from "./compare";
import { buildSectionsChecklist, missingRequiredSections } from "./sections-checklist";
import { buildSantaFeEnFoco2026RulesDraftMarkdown } from "./santa-fe-draft";
import {
  assertMinorAuthorizationReady,
  isAdultParticipant,
  requiresMinorAuthorization,
} from "./minors";
import { ManualPromptRulesGenerator, DeterministicSemanticValidator } from "./generator";

async function main() {
  const config = buildSantaFeEnFoco2026Configuration();
  const hash = hashContestRulesConfiguration(config);

  const prompt = buildChatGptRulesPrompt(config);
  assert.ok(prompt.includes("JSON DE CONFIGURACIÓN"));
  assert.ok(prompt.includes(hash));
  assert.ok(!prompt.includes("password"));
  assert.ok(!prompt.includes("OPENAI_API_KEY"));
  assert.ok(!prompt.includes("storageKey"));

  const gen = await new ManualPromptRulesGenerator().generate(config);
  assert.equal(gen.mode, "manual_prompt");

  const goodJson = JSON.stringify({
    documentTitle: "Bases SF",
    rulesDocument: buildSantaFeEnFoco2026RulesDraftMarkdown(),
    configurationSummary: { free: true },
    missingDecisions: [],
    warnings: [],
    declaredConfigurationHash: hash,
    sectionsCovered: ["cronograma", "premios"],
  });
  const parsed = parseExternalRulesAiResponse(goodJson);
  assert.equal(parsed.ok, true);
  assert.equal(parseExternalRulesAiResponse("{").ok, false);
  assert.equal(parseExternalRulesAiResponse("{}").ok, false);

  const dirty = sanitizeRulesHtml('<p>ok</p><script>alert(1)</script><iframe src="x"></iframe>');
  assert.ok(!dirty.includes("<script"));
  assert.ok(!dirty.includes("<iframe"));

  const n1 = normalizeContestRulesDocument("Hola\r\nMundo  ");
  const n2 = normalizeContestRulesDocument("Hola\nMundo");
  assert.equal(n1.contentHash, n2.contentHash);

  const draft = buildSantaFeEnFoco2026RulesDraftMarkdown();
  const cmp = compareRulesTextWithConfiguration(draft, config);
  assert.ok(cmp.some((c) => c.key === "official_name" && c.status === "MATCH"));
  assert.ok(!hasBlockingConflicts(cmp));

  const badDates = "El GPS será obligatorio. El concurso cuesta $1000. EXIF obligatorio.";
  const badCmp = compareRulesTextWithConfiguration(badDates, config);
  assert.ok(badCmp.some((c) => c.key === "gps" && c.status === "CONFLICT"));
  assert.ok(badCmp.some((c) => c.key === "price" && c.status === "CONFLICT"));
  assert.ok(badCmp.some((c) => c.key === "exif" && c.status === "CONFLICT"));

  const invented = "Peso máximo 5 MB y mínimo 12 megapíxeles.";
  assert.ok(
    compareRulesTextWithConfiguration(invented, config).some(
      (c) => c.key === "invented_file_limits" && c.status === "EXTRA_RULE",
    ),
  );

  const sections = buildSectionsChecklist(draft);
  assert.ok(missingRequiredSections(sections).length < 8);

  assert.equal(requiresMinorAuthorization(16), true);
  assert.equal(requiresMinorAuthorization(17), true);
  assert.equal(requiresMinorAuthorization(18), false);
  assert.equal(isAdultParticipant(30), true);
  assert.throws(() => assertMinorAuthorizationReady({ declaredAgeYears: 16, minorAuth: null }));
  assert.doesNotThrow(() =>
    assertMinorAuthorizationReady({
      declaredAgeYears: 16,
      minorAuth: { guardianName: "Ana", relationship: "Madre", declarationAccepted: true },
    }),
  );
  assert.doesNotThrow(() => assertMinorAuthorizationReady({ declaredAgeYears: 30 }));

  const semantic = await new DeterministicSemanticValidator().validate({
    config,
    document: draft,
    deterministic: cmp,
  });
  assert.equal(semantic.aiMayPublish, false);

  assert.equal(config.participation.adultAuthorizationRequired, true);
  assert.equal(config.jury.maxJudges, 5);

  console.log(
    JSON.stringify(
      {
        ok: true,
        hash: hash.slice(0, 12),
        compareItems: cmp.length,
        missingSections: missingRequiredSections(sections).length,
      },
      null,
      2,
    ),
  );
  console.log("rules-lifecycle.selfcheck.ts OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
