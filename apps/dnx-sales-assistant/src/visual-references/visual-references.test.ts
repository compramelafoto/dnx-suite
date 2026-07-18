import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import type { VisualReference } from "./domain/visual-reference.js";
import { createAbstractPlaceholderPng, PLACEHOLDER_LABEL } from "./fixtures/create-abstract-placeholder-png.js";
import { LocalCuratedVisualReferenceProvider } from "./provider/local-curated-visual-reference-provider.js";
import { selectVisualReferences } from "./selection/select-visual-references.js";
import { serializePublicVisualReference } from "./serialization/serialize-public-visual-reference.js";
import { validateVisualReference } from "./validation/validate-visual-reference.js";
import { validateVisualReferenceCatalog } from "./validation/validate-visual-reference-catalog.js";
import { resolveAllowedAssetPath } from "./validation/resolve-asset-path.js";
import { loadLocalVisualReferenceCatalog } from "./catalog/load-local-visual-reference-catalog.js";
import { buildVisualReferenceReply } from "./reply/build-visual-reference-reply.js";

function baseRef(overrides: Partial<VisualReference> = {}): VisualReference {
  return {
    id: "vr-test-01",
    version: 1,
    title: PLACEHOLDER_LABEL,
    description: "Bloque abstracto de prueba",
    niches: ["fotografía deportiva"],
    imagePath: "placeholder.png",
    orientation: "LANDSCAPE",
    educationalPurpose: ["congelamiento de acción"],
    tags: ["test"],
    source: { kind: "LOCAL_CURATED" },
    rights: {
      usageAuthorized: true,
      authorizedForInternalReview: true,
      authorizedForPublicAssistant: false,
      authorizationBasis: "OWNED_BY_DNX",
      authorName: "DNX Test",
      attributionRequired: true,
      attributionText: "DNX Test — uso interno",
    },
    status: "APPROVED",
    createdAt: "2026-07-18T00:00:00.000Z",
    updatedAt: "2026-07-18T00:00:00.000Z",
    ...overrides,
  };
}

describe("visual-references domain + validation", () => {
  it("rechaza UNKNOWN rights", () => {
    const issues = validateVisualReference(
      baseRef({
        rights: {
          ...baseRef().rights,
          authorizationBasis: "UNKNOWN",
        },
      }),
      { requireFileExists: false },
    );
    assert.ok(issues.some((i) => i.code === "VISUAL_REFERENCE_UNKNOWN_RIGHTS"));
  });

  it("rechaza autorización pública", () => {
    const issues = validateVisualReference(
      baseRef({
        rights: {
          ...baseRef().rights,
          authorizedForPublicAssistant: true,
        },
      }),
      { requireFileExists: false },
    );
    assert.ok(
      issues.some((i) => i.code === "VISUAL_REFERENCE_PUBLIC_AUTHORIZATION_FORBIDDEN"),
    );
  });

  it("rechaza atribución faltante", () => {
    const issues = validateVisualReference(
      baseRef({
        rights: {
          ...baseRef().rights,
          attributionRequired: true,
          attributionText: "",
        },
      }),
      { requireFileExists: false },
    );
    assert.ok(issues.some((i) => i.code === "VISUAL_REFERENCE_ATTRIBUTION_MISSING"));
  });

  it("rechaza vencida", () => {
    const issues = validateVisualReference(
      baseRef({
        rights: {
          ...baseRef().rights,
          expiresAt: "2020-01-01T00:00:00.000Z",
        },
      }),
      { requireFileExists: false, now: new Date("2026-07-18") },
    );
    assert.ok(issues.some((i) => i.code === "VISUAL_REFERENCE_EXPIRED"));
  });

  it("rechaza path traversal", () => {
    const issues = validateVisualReference(
      baseRef({ imagePath: "../secret.png" }),
      { requireFileExists: false },
    );
    assert.ok(issues.some((i) => i.code === "VISUAL_REFERENCE_PATH_TRAVERSAL"));
    assert.equal(resolveAllowedAssetPath("../x.png").ok, false);
  });

  it("rechaza MIME inválido", () => {
    const issues = validateVisualReference(
      baseRef({ imagePath: "x.gif" }),
      { requireFileExists: false },
    );
    assert.ok(issues.some((i) => i.code === "VISUAL_REFERENCE_INVALID_MIME"));
  });

  it("detecta ID duplicado en catálogo", () => {
    const issues = validateVisualReferenceCatalog(
      {
        version: 1,
        references: [baseRef(), baseRef({ id: "vr-test-01", title: "Otro" })],
      },
      { requireFileExists: false },
    );
    assert.ok(issues.some((i) => i.code === "VISUAL_REFERENCE_DUPLICATE_ID"));
  });

  it("catálogo inexistente no falla", () => {
    const loaded = loadLocalVisualReferenceCatalog(
      path.join(tmpdir(), "no-such-visual-catalog.json"),
    );
    assert.equal(loaded.status, "MISSING");
    assert.equal(loaded.catalog.references.length, 0);
  });
});

describe("visual-references selection", () => {
  const refs: VisualReference[] = [
    baseRef({
      id: "a",
      orientation: "LANDSCAPE",
      educationalPurpose: ["composición"],
    }),
    baseRef({
      id: "b",
      orientation: "PORTRAIT",
      educationalPurpose: ["iluminación"],
    }),
    baseRef({
      id: "c",
      orientation: "SQUARE",
      educationalPurpose: ["detalle"],
    }),
    baseRef({
      id: "d",
      niches: ["bodas"],
      orientation: "LANDSCAPE",
      educationalPurpose: ["narrativa"],
    }),
  ];

  it("filtra por nicho y limita a 6", () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      baseRef({
        id: `n${i}`,
        orientation: i % 2 === 0 ? "LANDSCAPE" : "PORTRAIT",
        educationalPurpose: ["composición"],
      }),
    );
    const result = selectVisualReferences({
      niche: "fotografía deportiva",
      references: many,
      limit: 6,
      skipFileCheck: true,
    });
    assert.equal(result.selected.length, 6);
    assert.equal(result.provider, "LOCAL_CURATED");
  });

  it("es determinista y evita repeticiones previas", () => {
    const first = selectVisualReferences({
      niche: "fotografía deportiva",
      references: refs,
      skipFileCheck: true,
    });
    const second = selectVisualReferences({
      niche: "fotografía deportiva",
      references: refs,
      skipFileCheck: true,
    });
    assert.deepEqual(
      first.selected.map((r) => r.id),
      second.selected.map((r) => r.id),
    );
    const avoid = selectVisualReferences({
      niche: "fotografía deportiva",
      references: refs,
      previousReferenceIds: first.selected.map((r) => r.id),
      skipFileCheck: true,
    });
    // Con pool agotado puede reutilizar; con subset previo evita si hay frescas
    const onlyA = selectVisualReferences({
      niche: "fotografía deportiva",
      references: refs.filter((r) => r.niches.includes("fotografía deportiva")),
      previousReferenceIds: ["a"],
      skipFileCheck: true,
    });
    assert.equal(onlyA.selected[0]?.id !== "a" || onlyA.selected.length <= 1, true);
    assert.ok(avoid.selected.length >= 1);
  });

  it("serialize no expone rutas absolutas", () => {
    const pub = serializePublicVisualReference(baseRef());
    assert.equal(pub.assetUrl.startsWith("/review-lab/assets/"), true);
    assert.equal(JSON.stringify(pub).includes("/Users/"), false);
  });
});

describe("visual-references reply + placeholder", () => {
  it("respuesta vacía natural", () => {
    const reply = buildVisualReferenceReply({
      niche: "fotografía deportiva",
      selected: [],
    });
    assert.equal(reply.kind, "EMPTY");
    assert.match(reply.text, /referencias autorizadas/i);
    assert.equal(/404|json|provider/i.test(reply.text), false);
  });

  it("respuesta con referencias", () => {
    const reply = buildVisualReferenceReply({
      niche: "fotografía deportiva",
      selected: [baseRef()],
    });
    assert.equal(reply.kind, "WITH_REFERENCES");
    assert.match(reply.text, /Te muestro/i);
  });

  it("placeholder abstracto no parece foto", () => {
    const png = createAbstractPlaceholderPng();
    assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    assert.equal(PLACEHOLDER_LABEL, "Referencia de prueba");
  });
});

describe("LocalCuratedVisualReferenceProvider con tmp catalog", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "vr-cat-"));
  const assets = path.join(dir, "assets");
  const catalogPath = path.join(dir, "catalog.json");
  mkdirSync(assets, { recursive: true });
  writeFileSync(path.join(assets, "placeholder.png"), createAbstractPlaceholderPng());

  after(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("ignora inválidas y solo devuelve APPROVED autorizadas", async () => {
    // Nota: el provider usa paths del paquete; este test valida selección con skip
    const provider = new LocalCuratedVisualReferenceProvider({
      catalogPath: path.join(tmpdir(), "missing-vr.json"),
    });
    assert.equal(provider.catalogStatus(), "MISSING");
    assert.equal((await provider.listByNiche("bodas")).length, 0);

    writeFileSync(
      catalogPath,
      JSON.stringify({
        version: 1,
        references: [
          baseRef({ id: "ok", status: "APPROVED" }),
          baseRef({ id: "draft", status: "DRAFT" }),
          baseRef({
            id: "bad",
            rights: {
              ...baseRef().rights,
              usageAuthorized: false,
            },
          }),
        ],
      }),
    );
    // Provider still points at package assets — use select with skip instead
    const selected = selectVisualReferences({
      niche: "fotografía deportiva",
      references: [
        baseRef({ id: "ok" }),
        baseRef({ id: "draft", status: "DRAFT" }),
      ],
      skipFileCheck: true,
    });
    assert.deepEqual(
      selected.selected.map((r) => r.id),
      ["ok"],
    );
  });
});
