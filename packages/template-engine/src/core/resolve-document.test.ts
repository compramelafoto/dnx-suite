import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createTemplateVariableRegistry } from "../variables/registry";
import {
  schoolTemplateVariablesPlugin,
  SCHOOL_TEMPLATE_EXAMPLE_DATA,
} from "../plugins/school";
import { fromLegacyTemplateV2 } from "../bridge/from-legacy-v2";
import { SCHOOL_FOLDER_MINIMAL_LEGACY_FIXTURE } from "../testing/fixtures/school-folder-minimal";
import { resolveTemplateDocument } from "./resolve-document";
import { createEmptyTemplateDocument } from "../schema/parse";

describe("resolveTemplateDocument", () => {
  const registry = createTemplateVariableRegistry([schoolTemplateVariablesPlugin]);

  it("resuelve texto dinámico e imágenes con plugin escolar", () => {
    const { document } = fromLegacyTemplateV2(SCHOOL_FOLDER_MINIMAL_LEGACY_FIXTURE, {
      name: "Resolve demo",
    });
    const result = resolveTemplateDocument({
      template: document,
      data: SCHOOL_TEMPLATE_EXAMPLE_DATA,
      registry,
    });

    const varText = result.document.blocks.find((b) => b.id === "blk-var-01");
    assert.equal(varText?.config.content, "María Gómez");

    const braced = result.document.blocks.find((b) => b.id === "blk-text-01");
    assert.equal(braced?.config.content, "3.º B · Mañana · Escuela Ejemplo");

    const logo = result.document.blocks.find((b) => b.id === "blk-logo-01");
    assert.equal(logo?.config.src, "https://cdn.example.com/school-logo.png");

    assert.ok(result.warnings.some((w) => w.code === "deprecated_alias"));
  });

  it("usa fallbacks y acumula required_missing sin lanzar", () => {
    const { document } = fromLegacyTemplateV2(SCHOOL_FOLDER_MINIMAL_LEGACY_FIXTURE);
    const result = resolveTemplateDocument({
      template: document,
      data: {},
      registry,
    });
    assert.ok(result.errors.some((e) => e.code === "required_missing"));
    const varText = result.document.blocks.find((b) => b.id === "blk-var-01");
    assert.equal(varText?.config.content, "—");
  });

  it("reporta formatter desconocido en bindings", () => {
    const doc = createEmptyTemplateDocument({ name: "Fmt" });
    doc.bindings = [
      {
        blockId: "x",
        targetPath: "variableKey",
        variableKey: "student.fullName",
        formatter: "emoji.party",
      },
    ];
    const result = resolveTemplateDocument({
      template: doc,
      data: SCHOOL_TEMPLATE_EXAMPLE_DATA,
      registry,
    });
    assert.ok(result.warnings.some((w) => w.code === "unknown_formatter"));
  });

  it("warns imagen sin URL", () => {
    const { document } = fromLegacyTemplateV2(SCHOOL_FOLDER_MINIMAL_LEGACY_FIXTURE);
    const result = resolveTemplateDocument({
      template: document,
      data: {
        ...SCHOOL_TEMPLATE_EXAMPLE_DATA,
        "branding.schoolLogoUrl": "",
      },
      registry,
    });
    assert.ok(result.warnings.some((w) => w.code === "image_without_url"));
  });
});
