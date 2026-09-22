import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { issueDiploma } from "@/lib/diplomas/diploma-service";

const deps = (over: Record<string, unknown> = {}) => ({
  loadRegistration: async () => ({
    id: "reg_1",
    editionId: "ed_1",
    firstName: "Ana",
    lastName: "Pérez",
    email: "ana@example.test",
    visibleCode: "CK1-0042",
    profilePhotoAssetId: null,
    checkIns: [{ checkedInAt: new Date("2026-09-19T19:30:00Z"), reversedAt: null }],
    edition: { name: "1ª Edición", slug: "dia-del-fotografo-2026" },
  }),
  resolveTemplate: async () => ({
    ok: true as const,
    preset: { id: "tpl", width: 1754, height: 1240 },
    source: {
      templateId: "t1",
      templateName: "Diploma",
      versionId: "v1",
      versionNumber: 1,
      revision: 1,
    },
    usesParticipantPhoto: false,
  }),
  renderPng: async () => ({ png: Buffer.from("png"), width: 1754, height: 1240, durationMs: 10 }),
  saveToStorage: async () => ({ storageKey: "k1", publicUrl: null }),
  upsertCard: async () => ({ id: "card_1" }),
  findExistingIssue: async () => null,
  createIssue: async (data: Record<string, unknown>) => ({ id: "dip_1", ...data }),
  updateIssue: async (data: Record<string, unknown>) => ({ id: "dip_1", ...data }),
  ...over,
});

describe("issueDiploma", () => {
  it("emite el diploma de un acreditado", async () => {
    const out = await issueDiploma({ registrationId: "reg_1", actor: { kind: "admin" } }, deps());
    assert.equal(out.ok, true);
    assert.equal(out.ok === true && out.diplomaCode, "DIP-CK1-0042");
    assert.ok(out.ok === true && out.verificationToken.length >= 24);
  });

  it("no emite si el participante no está acreditado", async () => {
    const out = await issueDiploma(
      { registrationId: "reg_1", actor: { kind: "admin" } },
      deps({
        loadRegistration: async () => ({
          id: "reg_1",
          editionId: "ed_1",
          firstName: "Ana",
          lastName: "Pérez",
          email: "ana@example.test",
          visibleCode: "CK1-0042",
          profilePhotoAssetId: null,
          checkIns: [],
          edition: { name: "1ª Edición", slug: "dia-del-fotografo-2026" },
        }),
      })
    );
    assert.equal(out.ok === false && out.code, "DIPLOMA_NOT_ACCREDITED");
  });

  it("no emite sin plantilla y no dibuja nada", async () => {
    let dibujos = 0;
    const out = await issueDiploma(
      { registrationId: "reg_1", actor: { kind: "admin" } },
      deps({
        resolveTemplate: async () => ({
          ok: false as const,
          code: "DIPLOMA_TEMPLATE_MISSING" as const,
          issues: [],
        }),
        renderPng: async () => {
          dibujos += 1;
          return { png: Buffer.from("x"), width: 1, height: 1, durationMs: 1 };
        },
      })
    );
    assert.equal(out.ok === false && out.code, "DIPLOMA_TEMPLATE_MISSING");
    assert.equal(dibujos, 0);
  });

  it("exige foto sólo si la plantilla la usa", async () => {
    const out = await issueDiploma(
      { registrationId: "reg_1", actor: { kind: "admin" } },
      deps({
        resolveTemplate: async () => ({
          ok: true as const,
          preset: { id: "tpl", width: 1754, height: 1240 },
          source: {
            templateId: "t1",
            templateName: "Con foto",
            versionId: "v1",
            versionNumber: 1,
            revision: 1,
          },
          usesParticipantPhoto: true,
        }),
      })
    );
    assert.equal(out.ok === false && out.code, "DIPLOMA_PHOTO_REQUIRED");
  });

  it("al rehacer conserva código y token", async () => {
    const out = await issueDiploma(
      { registrationId: "reg_1", actor: { kind: "admin" } },
      deps({
        findExistingIssue: async () => ({
          id: "dip_previo",
          diplomaCode: "DIP-CK1-0042",
          verificationToken: "token-viejo-que-no-cambia-xx",
          revokedAt: null,
        }),
      })
    );
    assert.equal(out.ok === true && out.diplomaId, "dip_previo");
    assert.equal(out.ok === true && out.verificationToken, "token-viejo-que-no-cambia-xx");
    assert.equal(out.ok === true && out.reused, true);
  });
});
