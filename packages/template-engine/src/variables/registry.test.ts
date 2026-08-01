import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createTemplateVariableRegistry } from "./registry";
import { schoolTemplateVariablesPlugin } from "../plugins/school";

describe("variable registry", () => {
  it("registra plugin escolar y hace lookup", () => {
    const registry = createTemplateVariableRegistry([schoolTemplateVariablesPlugin]);
    const def = registry.getVariableDefinition("student.fullName");
    assert.ok(def);
    assert.equal(def?.label.includes("Alumno"), true);
    assert.ok(registry.listVariableDefinitions().length >= 10);
  });

  it("resuelve aliases", () => {
    const registry = createTemplateVariableRegistry([schoolTemplateVariablesPlugin]);
    assert.equal(registry.resolvePathFromAlias("alumno"), "student.fullName");
    assert.equal(registry.resolvePathFromAlias("escuela"), "school.name");
  });

  it("detecta duplicados de path", () => {
    assert.throws(() => {
      const registry = createTemplateVariableRegistry([schoolTemplateVariablesPlugin]);
      registry.registerVariableDefinitions([
        {
          path: "student.fullName",
          label: "Dup",
          valueType: "text",
        },
      ]);
    }, /duplicate/);
  });

  it("detecta conflicto de aliases", () => {
    assert.throws(() => {
      createTemplateVariableRegistry([
        schoolTemplateVariablesPlugin,
        {
          id: "bad",
          definitions: [],
          aliases: { alumno: "buyer.fullName" },
        },
      ]);
    }, /alias conflict/);
  });

  it("resuelve valor anidado y plano", () => {
    const registry = createTemplateVariableRegistry([schoolTemplateVariablesPlugin]);
    const nested = registry.resolveTemplateVariable("student.fullName", {
      student: { fullName: "Ana" },
    });
    assert.equal(nested.status, "resolved");
    assert.equal(nested.formatted, "Ana");

    const flat = registry.resolveTemplateVariable("alumno", {
      "student.fullName": "Luis",
    });
    assert.equal(flat.status, "resolved");
    assert.equal(flat.formatted, "Luis");
  });

  it("diferencia missing vs empty y usa fallback", () => {
    const registry = createTemplateVariableRegistry([schoolTemplateVariablesPlugin]);
    const missing = registry.resolveTemplateVariable("student.fullName", {});
    assert.equal(missing.status, "missing");
    assert.equal(missing.usedFallback, true);
    assert.equal(missing.formatted, "—");

    const empty = registry.resolveTemplateVariable("student.fullName", {
      "student.fullName": "   ",
    });
    assert.equal(empty.status, "empty");
    assert.equal(empty.usedFallback, true);
  });

  it("bloquea path inseguro en resolución", () => {
    const registry = createTemplateVariableRegistry();
    const r = registry.resolveTemplateVariable("__proto__", { __proto__: { x: 1 } });
    assert.equal(r.status, "unsafe_path");
  });
});
