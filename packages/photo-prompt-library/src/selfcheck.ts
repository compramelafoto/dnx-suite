/**
 * Selfcheck @repo/photo-prompt-library
 * pnpm --filter @repo/photo-prompt-library selfcheck
 *
 * Nota secreto pre-reveal: la revelación al participante es responsabilidad
 * de ETAPA 12 (ClickatonEditionUploadConfig / toPromptPublicDto). Este
 * paquete solo garantiza snapshots en la asignación.
 */
import {
  assertTransition,
  canTransition,
  canUseCommercially,
  canUseInTestMode,
  assertAssignable,
} from "./workflow";
import { normalizeTitle } from "./normalize";
import {
  findExactNormalizedDuplicates,
  findSimilarityWarnings,
  jaccardSimilarity,
} from "./duplicates";
import {
  buildAssignmentSnapshot,
  snapshotToClickatonFields,
} from "./assignment";
import { importPreview } from "./import";
import { isSignificantUpdate } from "./service";
import {
  INITIAL_CINE_SUBTHEMES,
  INITIAL_PROMPTS,
  INITIAL_THEMES,
} from "./catalog-data";

type Check = { name: string; ok: boolean; detail?: string };

const checks: Check[] = [];

function check(name: string, fn: () => void) {
  try {
    fn();
    checks.push({ name, ok: true });
  } catch (err) {
    checks.push({
      name,
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    });
  }
}

function expect(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

check("catalog: 11 themes", () => {
  expect(INITIAL_THEMES.length === 11, `themes=${INITIAL_THEMES.length}`);
  expect(
    new Set(INITIAL_THEMES.map((t) => t.slug)).size === 11,
    "theme slugs unique",
  );
});

check("catalog: 6 cine subthemes", () => {
  expect(INITIAL_CINE_SUBTHEMES.length === 6, "subthemes");
});

check("catalog: exactly 55 prompts", () => {
  expect(INITIAL_PROMPTS.length === 55, `count=${INITIAL_PROMPTS.length}`);
  const keys = INITIAL_PROMPTS.map((p) => p.sourceKey);
  expect(new Set(keys).size === 55, "sourceKeys unique");
  expect(
    keys[0] === "INITIAL_DNX_PROMPT_LIBRARY_2026_01",
    "first sourceKey",
  );
  expect(
    keys[54] === "INITIAL_DNX_PROMPT_LIBRARY_2026_55",
    "last sourceKey",
  );
});

check("catalog: cine 51-55 have inspiration", () => {
  for (let i = 50; i < 55; i += 1) {
    const p = INITIAL_PROMPTS[i]!;
    expect(p.themeSlug === "cine", `${p.sourceKey} theme`);
    expect(!!p.inspirationType, `${p.sourceKey} inspirationType`);
    expect(!!p.inspirationLabel, `${p.sourceKey} inspirationLabel`);
    expect(!!p.subthemeSlug, `${p.sourceKey} subtheme`);
  }
});

check("normalizeTitle strips accents and collapses spaces", () => {
  expect(
    normalizeTitle("  Hóra   Azúl  ") === "hora azul",
    normalizeTitle("  Hóra   Azúl  "),
  );
});

check("workflow transitions happy path", () => {
  assertTransition("DRAFT", "IN_REVIEW");
  assertTransition("IN_REVIEW", "APPROVED");
  assertTransition("APPROVED", "ARCHIVED");
  assertTransition("ARCHIVED", "APPROVED");
  assertTransition("IN_REVIEW", "REJECTED");
  assertTransition("REJECTED", "DRAFT");
});

check("workflow rejects illegal transition", () => {
  expect(!canTransition("DRAFT", "APPROVED"), "draft→approved blocked");
  let threw = false;
  try {
    assertTransition("DRAFT", "APPROVED");
  } catch {
    threw = true;
  }
  expect(threw, "assertTransition should throw");
});

check("approval path commercial", () => {
  expect(canUseCommercially("APPROVED"), "approved ok");
  expect(!canUseCommercially("DRAFT"), "draft denied commercial");
  expect(!canUseCommercially("IN_REVIEW"), "in_review denied");
  expect(!canUseCommercially("REJECTED"), "rejected denied");
  expect(!canUseCommercially("ARCHIVED"), "archived denied");
});

check("DRAFT denied commercial; allowed in test mode", () => {
  expect(!canUseInTestMode("DRAFT", false), "draft without flag");
  expect(canUseInTestMode("DRAFT", true), "draft with flag");
  expect(canUseInTestMode("APPROVED", false), "approved always");
  let threw = false;
  try {
    assertAssignable({ status: "DRAFT", allowDraftForOpsTest: false });
  } catch {
    threw = true;
  }
  expect(threw, "commercial draft assign throws");
  assertAssignable({ status: "DRAFT", allowDraftForOpsTest: true });
  assertAssignable({ status: "APPROVED" });
});

check("versioning: significant update detection", () => {
  const current = {
    title: "A",
    description: "B",
    themeId: "t1",
    subthemeId: null as string | null,
    inspirationType: null as string | null,
    inspirationLabel: null as string | null,
    inspirationNotes: null as string | null,
    tags: ["x"],
    difficulty: "MEDIUM",
    language: "es",
    universal: true,
  };
  expect(
    isSignificantUpdate(current, { title: "A2" }),
    "title change significant",
  );
  expect(
    !isSignificantUpdate(current, { changeSummary: "meta only" }),
    "meta-only not significant",
  );
  expect(
    isSignificantUpdate(current, { tags: ["y"] }),
    "tags change significant",
  );
});

check("snapshot fields exist (pre-reveal secrecy = ETAPA 12)", () => {
  const snap = buildAssignmentSnapshot({
    id: "lib1",
    version: 3,
    title: "Secreto",
    description: "No revelar antes del reveal",
    inspirationType: "DIRECTOR",
    inspirationLabel: "Test",
    inspirationNotes: "nota",
    theme: { name: "Luz" },
    subtheme: { name: "—" },
  });
  expect(!!snap.titleSnapshot, "titleSnapshot");
  expect(!!snap.descriptionSnapshot, "descriptionSnapshot");
  expect(!!snap.themeSnapshot, "themeSnapshot");
  expect(snap.libraryVersion === 3, "libraryVersion");
  const fields = snapshotToClickatonFields(snap);
  expect(fields.titleSnapshot === "Secreto", "title copy");
  expect(fields.instructions === snap.descriptionSnapshot, "instructions");
  // Documentación: reveal/LOCKED es ETAPA 12 — aquí solo exigimos campos snapshot.
  expect(
    "titleSnapshot" in fields && "descriptionSnapshot" in fields,
    "snapshot keys for secrecy boundary",
  );
});

check("snapshot immutability vs library edit", () => {
  const item = {
    id: "lib2",
    version: 1,
    title: "Original",
    description: "Desc original",
    theme: { name: "Color" },
    subtheme: null,
  };
  const snap = buildAssignmentSnapshot(item);
  // Simula edición posterior de biblioteca
  item.title = "Editado después";
  item.description = "Nueva descripción";
  item.version = 2;
  expect(snap.titleSnapshot === "Original", "snapshot title frozen");
  expect(
    snap.descriptionSnapshot === "Desc original",
    "snapshot description frozen",
  );
  expect(snap.libraryVersion === 1, "snapshot version frozen");
});

check("duplicate exact + similarity warning (no merge)", () => {
  const items = [
    { id: "1", title: "Hora azul", normalizedTitle: normalizeTitle("Hora azul") },
    { id: "2", title: "hora  azul", normalizedTitle: normalizeTitle("hora  azul") },
    {
      id: "3",
      title: "Hora azul profunda",
      normalizedTitle: normalizeTitle("Hora azul profunda"),
    },
  ];
  const exact = findExactNormalizedDuplicates(items);
  expect(exact.length === 1, "one exact group");
  expect(exact[0]!.items.length === 2, "two exact items");
  const score = jaccardSimilarity("Hora azul", "Hora azul profunda");
  expect(score > 0.4, `jaccard=${score}`);
  const warnings = findSimilarityWarnings(
    [
      {
        id: "a",
        title: "luz suave que envuelve",
        normalizedTitle: normalizeTitle("luz suave que envuelve"),
      },
      {
        id: "b",
        title: "luz suave envolvente",
        normalizedTitle: normalizeTitle("luz suave envolvente"),
      },
    ],
    0.3,
  );
  expect(warnings.every((w) => w.kind === "similarity_warning"), "warning only");
});

check("usage shape helper via snapshot assign fields", () => {
  // Contador de uso = cantidad de asignaciones; aquí validamos el contrato de fields.
  const fields = snapshotToClickatonFields(
    buildAssignmentSnapshot({
      id: "u1",
      version: 1,
      title: "Uso",
      description: "d",
      theme: { name: "Luz" },
    }),
  );
  expect(fields.libraryItemId === "u1", "usage links libraryItemId");
});

check("import preview validates rows", () => {
  const preview = importPreview([
    {
      title: "Nueva",
      description: "Desc",
      themeSlug: "luz",
    },
    { title: "", description: "x", themeSlug: "luz" },
  ]);
  expect(preview.rows.length === 1, "one valid row");
  expect(
    preview.issues.some((i) => i.code === "MISSING_TITLE"),
    "missing title error",
  );
  expect(!preview.okToApply, "not ok with errors");
});

// Report
let pass = 0;
let fail = 0;
for (const c of checks) {
  if (c.ok) {
    pass += 1;
    console.log(`PASS  ${c.name}`);
  } else {
    fail += 1;
    console.log(`FAIL  ${c.name}${c.detail ? ` — ${c.detail}` : ""}`);
  }
}
console.log(`\nphoto-prompt-library selfcheck: ${pass} PASS / ${fail} FAIL`);
if (fail > 0) process.exit(1);
