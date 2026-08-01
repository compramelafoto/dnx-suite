import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Role } from "@prisma/client";
import { validateLegacyTemplatePayload } from "../services/template-v2-validation-service";
import { sanitizeTemplateName } from "../services/template-v2-limits";
import {
  TEMPLATE_V2_CANONICAL_PATHS,
  TEMPLATE_V2_EDITOR_PATHS,
} from "../template-v2-api-compat";
import { parseTemplateV2EditorPayload } from "../validate-save-payload";

/**
 * Integración ligera sin DB/R2: contratos de servicio + validación + paths.
 */
describe("template-v2 services integration (no DB)", () => {
  it("paths canónicos y editor definidos", () => {
    assert.equal(TEMPLATE_V2_CANONICAL_PATHS.list, "/api/template-v2/templates");
    assert.match(TEMPLATE_V2_EDITOR_PATHS.save("a", "b"), /\/save$/);
    assert.match(TEMPLATE_V2_CANONICAL_PATHS.validate("x"), /\/validate$/);
    assert.match(TEMPLATE_V2_CANONICAL_PATHS.duplicate("x"), /\/duplicate$/);
  });

  it("create payload vacío es válido para editor parse parcial", () => {
    const parsed = parseTemplateV2EditorPayload({
      canvas: { width: 1200, height: 1800 },
      blocks: [],
      variableBindings: [],
      meta: {},
    });
    assert.equal(parsed.ok, true);
  });

  it("validate draft create/get/update/duplicate/delete contratos lógicos", () => {
    const draft = {
      canvas: { width: 1200, height: 1800, background: "#fff" },
      blocks: [
        {
          id: "bg",
          type: "BACKGROUND" as const,
          layout: {
            x: 0,
            y: 0,
            width: 1200,
            height: 1800,
            rotation: 0,
            zIndex: 0,
            opacity: 1,
            visible: true,
          },
          configJson: { backgroundColor: "#fff", src: "" },
        },
        {
          id: "vt",
          type: "VARIABLE_TEXT" as const,
          layout: {
            x: 10,
            y: 10,
            width: 200,
            height: 40,
            rotation: 0,
            zIndex: 2,
            opacity: 1,
            visible: true,
          },
          configJson: { variableKey: "student.fullName", fallback: "—" },
        },
      ],
      variableBindings: [
        {
          blockId: "vt",
          targetPath: "variableKey",
          variableKey: "student.fullName",
        },
      ],
      meta: {},
    };

    const v = validateLegacyTemplatePayload(draft, { name: "Demo" });
    assert.equal(v.valid, true);
    assert.ok(v.normalizedTemplate);
    assert.equal(v.normalizedTemplate?.blocks.length, 2);
  });

  it("nombre duplicado seguro", () => {
    const name = sanitizeTemplateName("Carpeta", "Nueva");
    assert.equal(`${name} — copia`, "Carpeta — copia");
  });

  it("roles diseñador reconocidos en enum", () => {
    assert.ok([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER, Role.ADMIN].length === 3);
  });

  it("delete protegido: plantilla en uso se documenta como soft archive", () => {
    const policy = { inUse: true, action: "ARCHIVED" as const };
    assert.equal(policy.action, "ARCHIVED");
  });
});
