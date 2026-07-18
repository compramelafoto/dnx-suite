import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import { importLabExport } from "./import/import-lab-export.js";
import { normalizeCalibrationCode } from "./normalization/normalize-calibration-code.js";
import { groupCalibrationItems } from "./grouping/group-calibration-items.js";
import { redactPersonalData } from "./redaction/redact-personal-data.js";
import { sanitizeCalibrationExport } from "./serialization/sanitize-calibration-export.js";
import { EMPTY_CALIBRATION_STORE, type CalibrationStore } from "./domain/calibration-item.js";
import { runWithCopyOverrides } from "../conversation/style/dani-v1/dani-copy-catalog.js";
import { getCopyById } from "../conversation/style/dani-v1/dani-copy-catalog.js";
import { CALIBRATION_ALLOWED_IMPORT_ROOTS } from "./paths.js";

function sampleExport(sessionId: string) {
  return {
    kind: "dnx-sales-assistant-review-lab-export",
    version: 1,
    sessionId,
    styleEngine: "dani-conversation-v1",
    turns: [
      {
        turnNumber: 1,
        userMessage: "Che, me salió un casamiento.",
        assistantMessage: "Perfecto. ¿Cuándo sería?",
        diagnostics: {
          intent: "QUOTE_REQUEST",
          knownFields: ["SERVICE_TYPE"],
          missingFields: ["EVENT_DATE"],
          askedField: "EVENT_DATE",
          daniScore: 100,
          flags: [],
          appliedCopyIds: ["ASK_EVENT_DATE_01"],
          styleVersion: "dani-conversation-v1",
        },
        humanReview: {
          verdict: "NEEDS_ADJUSTMENT" as const,
          note: 'Yo no diría "Perfecto" acá.',
          styleVersion: "dani-conversation-v1",
          askedField: "EVENT_DATE",
          createdAt: "2026-07-18T00:00:00.000Z",
        },
      },
      {
        turnNumber: 2,
        userMessage: "Es en Rosario.",
        assistantMessage: "Entiendo. ¿Qué día se hace?",
        diagnostics: {
          intent: "QUOTE_REQUEST",
          knownFields: ["SERVICE_TYPE", "CITY"],
          missingFields: ["EVENT_DATE"],
          askedField: "EVENT_DATE",
          daniScore: 80,
          flags: [{ code: "DANI_STYLE_REPEATED_QUESTION" }],
          appliedCopyIds: ["ASK_EVENT_DATE_02"],
          styleVersion: "dani-conversation-v1",
        },
        humanReview: {
          verdict: "APPROVED" as const,
          note: "Está bien.",
          styleVersion: "dani-conversation-v1",
          createdAt: "2026-07-18T00:01:00.000Z",
        },
      },
      {
        turnNumber: 3,
        userMessage: "x",
        assistantMessage: "y",
        diagnostics: {
          daniScore: 100,
          flags: [],
          appliedCopyIds: ["CONF_01"],
        },
        humanReview: {
          verdict: "INCORRECT" as const,
          note: "Incorrecta",
          styleVersion: "dani-conversation-v1",
          createdAt: "2026-07-18T00:02:00.000Z",
        },
      },
    ],
    humanReviews: [],
    humanVisualReviews: [
      {
        referenceId: "vr-1",
        niche: "bodas",
        verdict: "WRONG_NICHE",
        createdAt: "2026-07-18T00:03:00.000Z",
      },
    ],
  };
}

describe("calibration import + normalize", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "cal-imp-"));
  // Allow import by writing under a symlink-like allowed root: use review-lab path via override
  // We test path rejection and in-memory import via rewriting CALIBRATION roots is hard —
  // write into first allowed root if it exists, else skip path and test pure functions.

  after(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("normaliza por nota y flags", () => {
    const byNote = normalizeCalibrationCode({
      verdict: "NEEDS_ADJUSTMENT",
      note: 'Yo no diría "Perfecto" acá.',
      styleFlags: [],
      styleScore: 100,
    });
    assert.equal(byNote.code, "CALIBRATION_UNNATURAL_CONFIRMATION");

    const byFlag = normalizeCalibrationCode({
      verdict: "NEEDS_ADJUSTMENT",
      styleFlags: ["DANI_STYLE_REPEATED_QUESTION"],
      styleScore: 80,
    });
    assert.equal(byFlag.code, "CALIBRATION_REPEATED_QUESTION");

    const disc = normalizeCalibrationCode({
      verdict: "INCORRECT",
      styleFlags: [],
      styleScore: 100,
    });
    assert.equal(disc.code, "CALIBRATION_HIGH_SCORE_HUMAN_REJECTED");

    const low = normalizeCalibrationCode({
      verdict: "APPROVED",
      styleFlags: [],
      styleScore: 80,
    });
    assert.equal(low.code, "CALIBRATION_LOW_SCORE_HUMAN_APPROVED");
  });

  it("rechaza path fuera de directorios permitidos", () => {
    const store: CalibrationStore = {
      ...EMPTY_CALIBRATION_STORE,
      items: [],
      visualItems: [],
      importedSessionIds: [],
      goldenCases: [],
      pendingGoldenProposals: [],
      copyProposals: [],
      ruleProposals: [],
    };
    const bad = importLabExport("/tmp/evil-export.json", store);
    assert.equal(bad.ok, false);
    if (!bad.ok) assert.equal(bad.error, "IMPORT_PATH_NOT_ALLOWED");
  });

  it("importa export válido desde directorio permitido", () => {
    const root = CALIBRATION_ALLOWED_IMPORT_ROOTS[0];
    mkdirSync(root, { recursive: true });
    const file = path.join(root, `test-export-${Date.now()}.json`);
    writeFileSync(file, JSON.stringify(sampleExport(`sess-${Date.now()}`)));
    const store: CalibrationStore = {
      ...EMPTY_CALIBRATION_STORE,
      items: [],
      visualItems: [],
      importedSessionIds: [],
      goldenCases: [],
      pendingGoldenProposals: [],
      copyProposals: [],
      ruleProposals: [],
    };
    const result = importLabExport(file, store);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.itemsAdded, 3);
      assert.equal(result.visualAdded, 1);
      assert.ok(result.store.items.some((i) => i.appliedCopyIds.includes("ASK_EVENT_DATE_01")));
      const dup = importLabExport(file, result.store);
      assert.equal(dup.ok, false);
    }
  });

  it("agrupa por copy ID", () => {
    const store: CalibrationStore = {
      ...EMPTY_CALIBRATION_STORE,
      items: [],
      visualItems: [],
      importedSessionIds: [],
      goldenCases: [],
      pendingGoldenProposals: [],
      copyProposals: [],
      ruleProposals: [],
    };
    const root = CALIBRATION_ALLOWED_IMPORT_ROOTS[0];
    const file = path.join(root, `test-export-group-${Date.now()}.json`);
    writeFileSync(file, JSON.stringify(sampleExport(`sess-g-${Date.now()}`)));
    const result = importLabExport(file, store);
    assert.equal(result.ok, true);
    if (result.ok) {
      const groups = groupCalibrationItems(result.store.items);
      assert.ok(groups.byCopyId.some((g) => g.key === "ASK_EVENT_DATE_01"));
    }
  });

  it("redacta emails y teléfonos", () => {
    const out = redactPersonalData("Escribime a dani@example.com o al 3415551234");
    assert.match(out, /REDACTED_EMAIL/);
    assert.match(out, /REDACTED_PHONE/);
  });

  it("export sanitizado sin leaks", () => {
    const store: CalibrationStore = {
      ...EMPTY_CALIBRATION_STORE,
      updatedAt: "2026-07-18T00:00:00.000Z",
      items: [
        {
          id: "cal-1",
          sourceSessionId: "s",
          turnNumber: 1,
          userMessage: "hola",
          assistantMessage: "ok",
          previousMessages: [],
          verdict: "APPROVED",
          styleVersion: "dani-conversation-v1",
          appliedCopyIds: ["ASK_EVENT_DATE_01"],
          knownFields: [],
          missingFields: [],
          styleFlags: [],
          calibrationCode: "CALIBRATION_OTHER",
          calibrationCodeSource: "AUTO",
          createdAt: "2026-07-18T00:00:00.000Z",
          importedAt: "2026-07-18T00:00:00.000Z",
          styleScore: 100,
        },
      ],
      visualItems: [],
      importedSessionIds: ["s"],
      goldenCases: [],
      pendingGoldenProposals: [],
      copyProposals: [],
      ruleProposals: [],
    };
    const payload = sanitizeCalibrationExport(store);
    const raw = JSON.stringify(payload);
    assert.equal(/breakdown|recommendedBusiness|\/Users\//i.test(raw), false);
    assert.equal(payload.kind, "dnx-sales-assistant-calibration-export");
  });

  it("overrides de copy no mutan catálogo base", () => {
    const before = getCopyById("ASK_EVENT_DATE_01")?.text;
    runWithCopyOverrides(
      { textOverrides: { ASK_EVENT_DATE_01: "Texto de prueba temporal." } },
      () => {
        assert.equal(getCopyById("ASK_EVENT_DATE_01")?.text, "Texto de prueba temporal.");
      },
    );
    assert.equal(getCopyById("ASK_EVENT_DATE_01")?.text, before);
  });
});
