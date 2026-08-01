import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isTemplateBinding,
  normalizeTemplateBinding,
  parseTemplateBinding,
  serializeTemplateBinding,
} from "./index";
import { SCHOOL_TEMPLATE_ALIASES } from "../plugins/school/aliases";

const known = new Set([
  "student.fullName",
  "school.name",
  "course.displayName",
]);

describe("bindings", () => {
  it("parsea {student.fullName}", () => {
    const r = parseTemplateBinding("{student.fullName}");
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.binding.type, "variable");
      assert.equal(r.binding.path, "student.fullName");
      assert.equal(r.binding.original, "{student.fullName}");
    }
  });

  it("normaliza {alumno} → student.fullName", () => {
    const r = normalizeTemplateBinding("{alumno}", {
      aliases: SCHOOL_TEMPLATE_ALIASES,
      knownPaths: known,
    });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.binding.path, "student.fullName");
      assert.equal(r.binding.aliasUsed, "alumno");
    }
  });

  it("soporta aliases y compact match", () => {
    const r = normalizeTemplateBinding("{studentFullName}", {
      aliases: SCHOOL_TEMPLATE_ALIASES,
      knownPaths: known,
    });
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.binding.path, "student.fullName");
  });

  it("bloquea paths peligrosos", () => {
    const r = parseTemplateBinding("{__proto__.x}");
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.error, /peligroso|inválido/);
  });

  it("bloquea constructor", () => {
    const r = parseTemplateBinding("foo.constructor.bar");
    assert.equal(r.ok, false);
  });

  it("parsea legacy {{key | fallback}}", () => {
    const r = parseTemplateBinding('{{student.fullName | "—"}}');
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.binding.path, "student.fullName");
      assert.equal(r.binding.fallback, "—");
    }
  });

  it("serializa binding canónico", () => {
    assert.equal(
      serializeTemplateBinding({
        type: "variable",
        path: "school.name",
        original: "{escuela}",
      }),
      "{school.name}"
    );
  });

  it("isTemplateBinding valida forma", () => {
    assert.equal(
      isTemplateBinding({
        type: "variable",
        path: "student.fullName",
        original: "{alumno}",
      }),
      true
    );
    assert.equal(isTemplateBinding({ type: "variable", path: "__proto__", original: "x" }), false);
  });

  it("rechaza sintaxis inválida", () => {
    const r = parseTemplateBinding("{}");
    assert.equal(r.ok, false);
  });

  it("alias desconocido falla en normalize", () => {
    const r = normalizeTemplateBinding("{noexiste}", {
      aliases: SCHOOL_TEMPLATE_ALIASES,
      knownPaths: known,
    });
    assert.equal(r.ok, false);
  });
});
