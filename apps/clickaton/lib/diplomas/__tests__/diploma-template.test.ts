import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { TemplateV2LegacyPayload } from "@repo/db/template-v2-repository";
import { resolveDiplomaTemplate } from "@/lib/diplomas/diploma-template";

const payloadValido: TemplateV2LegacyPayload = {
  canvas: { width: 1754, height: 1240 },
  blocks: [
    {
      id: "b1",
      type: "BACKGROUND",
      layout: { x: 0, y: 0, width: 1754, height: 1240 },
      configJson: { backgroundColor: "#ffffff" },
    },
    {
      id: "b2",
      type: "VARIABLE_TEXT",
      layout: { x: 100, y: 100, width: 800, height: 120 },
      configJson: { variableKey: "participant.fullName" },
    },
  ],
};

describe("resolveDiplomaTemplate", () => {
  it("falla sin plantilla asignada y no devuelve preset", async () => {
    const out = await resolveDiplomaTemplate(
      { editionId: "ed_1" },
      { loadAssignment: async () => null, loadTemplate: async () => null }
    );
    assert.equal(out.ok, false);
    assert.equal(out.ok === false && out.code, "DIPLOMA_TEMPLATE_MISSING");
    assert.ok(!("preset" in out));
  });

  it("falla si la asignación está deshabilitada", async () => {
    const out = await resolveDiplomaTemplate(
      { editionId: "ed_1" },
      {
        loadAssignment: async () => ({ templateId: "t1", versionId: null, enabled: false }),
        loadTemplate: async () => null,
      }
    );
    assert.equal(out.ok === false && out.code, "DIPLOMA_TEMPLATE_MISSING");
  });

  it("falla si la plantilla ya no existe", async () => {
    const out = await resolveDiplomaTemplate(
      { editionId: "ed_1" },
      {
        loadAssignment: async () => ({ templateId: "t1", versionId: null, enabled: true }),
        loadTemplate: async () => null,
      }
    );
    assert.equal(out.ok === false && out.code, "DIPLOMA_TEMPLATE_UNAVAILABLE");
  });

  it("falla y lista los problemas si la plantilla es inválida", async () => {
    const out = await resolveDiplomaTemplate(
      { editionId: "ed_1" },
      {
        loadAssignment: async () => ({ templateId: "t1", versionId: null, enabled: true }),
        loadTemplate: async () => ({
          template: { id: "t1", name: "Diploma" },
          version: { id: "v1", versionNumber: 1, revision: 1 },
          payload: { canvas: { width: 0, height: 0 }, blocks: [] },
        }),
      }
    );
    assert.equal(out.ok === false && out.code, "DIPLOMA_TEMPLATE_INVALID");
    assert.ok(out.ok === false && out.issues.length > 0);
  });

  it("acepta una plantilla válida y dice si usa la foto", async () => {
    const out = await resolveDiplomaTemplate(
      { editionId: "ed_1" },
      {
        loadAssignment: async () => ({ templateId: "t1", versionId: null, enabled: true }),
        loadTemplate: async () => ({
          template: { id: "t1", name: "Diploma 1ª edición" },
          version: { id: "v1", versionNumber: 2, revision: 3 },
          payload: payloadValido,
        }),
      }
    );
    assert.equal(out.ok, true);
    assert.equal(out.ok === true && out.source.templateName, "Diploma 1ª edición");
    assert.equal(out.ok === true && out.usesParticipantPhoto, false);
  });

  it("detecta que la plantilla usa la foto del participante", async () => {
    const conFoto: TemplateV2LegacyPayload = {
      ...payloadValido,
      blocks: [
        ...payloadValido.blocks,
        {
          id: "b3",
          type: "PHOTO",
          layout: { x: 200, y: 200, width: 300, height: 300 },
          configJson: { variableKey: "participant.photoUrl" },
        },
      ],
    };
    const out = await resolveDiplomaTemplate(
      { editionId: "ed_1" },
      {
        loadAssignment: async () => ({ templateId: "t1", versionId: null, enabled: true }),
        loadTemplate: async () => ({
          template: { id: "t1", name: "Con foto" },
          version: { id: "v1", versionNumber: 1, revision: 1 },
          payload: conFoto,
        }),
      }
    );
    assert.equal(out.ok === true && out.usesParticipantPhoto, true);
  });
});
