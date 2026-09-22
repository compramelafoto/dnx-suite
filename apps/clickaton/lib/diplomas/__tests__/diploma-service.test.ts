import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatDateShort } from "@repo/template-engine";
import {
  DiplomaServiceError,
  DiplomaUniqueViolationError,
  issueDiploma,
  renderDiplomaPreview,
  type DiplomaRenderPngInput,
} from "@/lib/diplomas/diploma-service";
import { templateV2ToCardPreset } from "@/lib/participant-cards/participant-card-template-source";

const deps = (over: Record<string, unknown> = {}) => ({
  checkAccess: () => {},
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
  resolvePhoto: async () => null,
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

  it("un no acreditado nunca ve el motivo de la plantilla (el orden importa)", async () => {
    // Aunque la plantilla también falle, un no acreditado tiene que enterarse
    // de que no está acreditado, no de que falta la plantilla: si se invirtiera
    // el orden (plantilla antes que acreditación), este test lo detecta.
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
        resolveTemplate: async () => ({
          ok: false as const,
          code: "DIPLOMA_TEMPLATE_MISSING" as const,
          issues: [],
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

  it("con foto presente y plantilla que la usa, emite igual", async () => {
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
          profilePhotoAssetId: "photo_1",
          checkIns: [{ checkedInAt: new Date("2026-09-19T19:30:00Z"), reversedAt: null }],
          edition: { name: "1ª Edición", slug: "dia-del-fotografo-2026" },
        }),
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
        resolvePhoto: async () => "data:image/png;base64,Zm90bw==",
      })
    );
    assert.equal(out.ok, true);
  });

  it("si la foto no se puede leer, no se emite (no queda un archivo roto)", async () => {
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
          profilePhotoAssetId: "photo_1",
          checkIns: [{ checkedInAt: new Date("2026-09-19T19:30:00Z"), reversedAt: null }],
          edition: { name: "1ª Edición", slug: "dia-del-fotografo-2026" },
        }),
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
        resolvePhoto: async () => {
          throw new Error("storage caído");
        },
      })
    );
    assert.equal(out.ok === false && out.code, "DIPLOMA_PHOTO_UNREADABLE");
  });

  it("no emite si el actor no tiene permiso", async () => {
    const out = await issueDiploma(
      { registrationId: "reg_1", actor: { kind: "admin" } },
      deps({
        checkAccess: () => {
          throw new Error("no autorizado");
        },
      })
    );
    assert.equal(out.ok === false && out.code, "DIPLOMA_FORBIDDEN");
  });

  it("una inscripción inexistente no revienta: devuelve un motivo conocido", async () => {
    const out = await issueDiploma(
      { registrationId: "reg_inexistente", actor: { kind: "admin" } },
      deps({ loadRegistration: async () => null })
    );
    assert.equal(out.ok === false && out.code, "DIPLOMA_REGISTRATION_NOT_FOUND");
  });

  it("si una variable del diploma queda sin resolver, no se emite (no queda quemado el código)", async () => {
    const out = await issueDiploma(
      { registrationId: "reg_1", actor: { kind: "admin" } },
      deps({
        renderPng: async () => {
          throw new DiplomaServiceError("DIPLOMA_TEMPLATE_INVALID", [
            "variable inexistente: diploma.code",
          ]);
        },
      })
    );
    assert.equal(out.ok === false && out.code, "DIPLOMA_TEMPLATE_INVALID");
  });

  it("un fallo crudo de storage o de base no escapa como excepción", async () => {
    const out = await issueDiploma(
      { registrationId: "reg_1", actor: { kind: "admin" } },
      deps({
        saveToStorage: async () => {
          throw new Error("R2 no disponible");
        },
      })
    );
    assert.equal(out.ok === false && out.code, "DIPLOMA_ISSUE_FAILED");
  });

  it("al rehacer conserva código, token y fecha de emisión, y no llama a createIssue", async () => {
    let createCalls = 0;
    const fechaOriginal = new Date("2026-08-01T12:00:00Z");
    const out = await issueDiploma(
      { registrationId: "reg_1", actor: { kind: "admin" } },
      deps({
        // "Hoy" es bien distinto de la emisión original: si el servicio usara
        // esta fecha en vez de la guardada, el test de abajo lo detecta.
        now: () => new Date("2026-09-25T08:00:00Z"),
        findExistingIssue: async () => ({
          id: "dip_previo",
          // Deliberadamente distinto de lo que buildDiplomaCode calcularía hoy
          // (sería "DIP-CK1-0042"): si se borra el reuso, este test lo detecta.
          diplomaCode: "DIP-CK1-0042-OLD",
          verificationToken: "token-viejo-que-no-cambia-xx",
          issuedAt: fechaOriginal,
          cardId: "card_previo",
          revokedAt: null,
        }),
        createIssue: async (data: Record<string, unknown>) => {
          createCalls += 1;
          return { id: "no-debería-pasar", ...data };
        },
      })
    );
    assert.equal(out.ok === true && out.diplomaId, "dip_previo");
    assert.equal(out.ok === true && out.diplomaCode, "DIP-CK1-0042-OLD");
    assert.equal(out.ok === true && out.verificationToken, "token-viejo-que-no-cambia-xx");
    assert.equal(out.ok === true && out.reused, true);
    assert.equal(createCalls, 0);
  });

  it("al rehacer, la fecha impresa es la de la emisión original, no la de hoy", async () => {
    const fechaOriginal = new Date("2026-08-01T12:00:00Z");
    let issuedAtFormatted: unknown;
    const out = await issueDiploma(
      { registrationId: "reg_1", actor: { kind: "admin" } },
      deps({
        now: () => new Date("2026-09-25T08:00:00Z"),
        findExistingIssue: async () => ({
          id: "dip_previo",
          diplomaCode: "DIP-CK1-0042",
          verificationToken: "token-viejo-que-no-cambia-xx",
          issuedAt: fechaOriginal,
          cardId: "card_previo",
          revokedAt: null,
        }),
        renderPng: async (input: DiplomaRenderPngInput) => {
          issuedAtFormatted = input.templateData["diploma.issuedAtFormatted"];
          return { png: Buffer.from("png"), width: 1754, height: 1240, durationMs: 10 };
        },
      })
    );
    assert.equal(out.ok, true);
    assert.equal(issuedAtFormatted, formatDateShort(fechaOriginal, "America/Argentina/Cordoba"));
  });

  it("un diploma revocado no se reusa: se emite uno nuevo", async () => {
    let createCalls = 0;
    const out = await issueDiploma(
      { registrationId: "reg_1", actor: { kind: "admin" } },
      deps({
        findExistingIssue: async () => ({
          id: "dip_revocado",
          diplomaCode: "DIP-VIEJO-REVOCADO",
          verificationToken: "token-revocado-no-se-usa-mas-xx",
          issuedAt: new Date("2026-01-01T00:00:00Z"),
          cardId: "card_viejo",
          revokedAt: new Date("2026-02-01T00:00:00Z"),
        }),
        createIssue: async (data: Record<string, unknown>) => {
          createCalls += 1;
          return { id: "dip_nuevo", ...data };
        },
      })
    );
    assert.equal(out.ok, true);
    assert.equal(out.ok === true && out.reused, false);
    assert.equal(out.ok === true && out.diplomaCode, "DIP-CK1-0042");
    assert.notEqual(
      out.ok === true && out.verificationToken,
      "token-revocado-no-se-usa-mas-xx"
    );
    assert.equal(createCalls, 1);
  });

  it("una carrera de doble clic termina en reused, no en un error crudo", async () => {
    let findCalls = 0;
    const out = await issueDiploma(
      { registrationId: "reg_1", actor: { kind: "admin" } },
      deps({
        findExistingIssue: async () => {
          findCalls += 1;
          if (findCalls === 1) return null;
          return {
            id: "dip_ganador",
            diplomaCode: "DIP-CK1-0042",
            verificationToken: "token-del-ganador-de-la-carrera",
            issuedAt: new Date("2026-09-19T12:00:00Z"),
            cardId: "card_ganador",
            revokedAt: null,
          };
        },
        createIssue: async () => {
          throw new DiplomaUniqueViolationError();
        },
      })
    );
    assert.equal(out.ok, true);
    assert.equal(out.ok === true && out.reused, true);
    assert.equal(out.ok === true && out.diplomaId, "dip_ganador");
    assert.equal(out.ok === true && out.cardId, "card_ganador");
    assert.equal(
      out.ok === true && out.verificationToken,
      "token-del-ganador-de-la-carrera"
    );
  });
});

describe("renderDiplomaPreview", () => {
  it("devuelve el PNG sin persistir nada", async () => {
    let upsertCalls = 0;
    let createCalls = 0;
    let updateCalls = 0;
    let findCalls = 0;
    let saveCalls = 0;
    const out = await renderDiplomaPreview(
      { registrationId: "reg_1", actor: { kind: "admin" } },
      deps({
        upsertCard: async () => {
          upsertCalls += 1;
          return { id: "card_x" };
        },
        createIssue: async (data: Record<string, unknown>) => {
          createCalls += 1;
          return { id: "dip_x", ...data };
        },
        updateIssue: async (data: Record<string, unknown>) => {
          updateCalls += 1;
          return { id: "dip_x", ...data };
        },
        findExistingIssue: async () => {
          findCalls += 1;
          return null;
        },
        saveToStorage: async () => {
          saveCalls += 1;
          return { storageKey: "k1", publicUrl: null };
        },
      })
    );
    assert.equal(out.ok, true);
    assert.equal(out.ok === true && Buffer.isBuffer(out.png), true);
    assert.equal(out.ok === true && out.width, 1754);
    assert.equal(out.ok === true && out.height, 1240);
    // Ni la pieza ni el emisor se tocan: ninguna de estas funciones se llama.
    assert.equal(upsertCalls, 0);
    assert.equal(createCalls, 0);
    assert.equal(updateCalls, 0);
    assert.equal(findCalls, 0);
    assert.equal(saveCalls, 0);
  });

  it("no dibuja si el participante no está acreditado", async () => {
    let dibujos = 0;
    const out = await renderDiplomaPreview(
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
        renderPng: async () => {
          dibujos += 1;
          return { png: Buffer.from("x"), width: 1, height: 1, durationMs: 1 };
        },
      })
    );
    assert.equal(out.ok === false && out.code, "DIPLOMA_NOT_ACCREDITED");
    assert.equal(dibujos, 0);
  });

  it("no dibuja sin plantilla asignada", async () => {
    const out = await renderDiplomaPreview(
      { registrationId: "reg_1", actor: { kind: "admin" } },
      deps({
        resolveTemplate: async () => ({
          ok: false as const,
          code: "DIPLOMA_TEMPLATE_MISSING" as const,
          issues: [],
        }),
      })
    );
    assert.equal(out.ok === false && out.code, "DIPLOMA_TEMPLATE_MISSING");
  });

  it("exige foto si la plantilla la usa", async () => {
    const out = await renderDiplomaPreview(
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

  it("respeta la autorización del actor", async () => {
    const out = await renderDiplomaPreview(
      { registrationId: "reg_1", actor: { kind: "admin" } },
      deps({
        checkAccess: () => {
          throw new Error("no autorizado");
        },
      })
    );
    assert.equal(out.ok === false && out.code, "DIPLOMA_FORBIDDEN");
  });

  it("usa código y token de muestra, nunca uno real", async () => {
    let dataVisto: Record<string, unknown> | null = null;
    await renderDiplomaPreview(
      { registrationId: "reg_1", actor: { kind: "admin" } },
      deps({
        renderPng: async (input: DiplomaRenderPngInput) => {
          dataVisto = input.templateData;
          return { png: Buffer.from("x"), width: 1, height: 1, durationMs: 1 };
        },
      })
    );
    assert.equal(dataVisto !== null && dataVisto["diploma.code"], "MUESTRA");
  });
});

/**
 * El cableado que agrega Task 10: `defaultRenderPng` (dentro de este archivo) →
 * `resolveParticipantCardRenderProvider().render({document, templateData})` →
 * `DesignStudioRenderProvider.render` → `renderResolvedDocumentWithDesignStudio`.
 *
 * Ningún otro test de este archivo lo ejercita: todos fijan `renderPng` a un doble, así que
 * `defaultRenderPng` nunca corre. Sin este describe, revertir cualquiera de esas tres líneas de
 * cableado —volver a `provider.render({ document })` sin `templateData`, o perder el segundo
 * argumento de `renderResolvedDocumentWithDesignStudio`— no rompería ningún test del proyecto.
 *
 * No usa el `deps()` de arriba a propósito: ese helper fija `renderPng`, que es justo lo que hay
 * que dejar sin fijar para que `resolveDeps` caiga en el `defaultRenderPng` real.
 */
describe("renderDiplomaPreview: el trayecto real de dibujo (sin doble de renderPng)", () => {
  const registration = {
    id: "reg_1",
    editionId: "ed_1",
    firstName: "Ana",
    lastName: "Pérez",
    email: "ana@example.test",
    visibleCode: "CK1-0042",
    profilePhotoAssetId: null,
    checkIns: [{ checkedInAt: new Date("2026-09-19T19:30:00Z"), reversedAt: null }],
    edition: { name: "1ª Edición", slug: "dia-del-fotografo-2026" },
  };

  /** Preset mínimo de diploma con un solo bloque QR de variable. */
  function presetConQr(variableKey: string) {
    return templateV2ToCardPreset(
      {
        templateId: "tpl_qr",
        templateName: "Diploma con QR",
        versionId: "v1",
        versionNumber: 1,
        revision: 1,
        payload: {
          canvas: { width: 1754, height: 1240 },
          blocks: [
            {
              id: "qr1",
              type: "QR",
              name: "QR de verificación",
              pageIndex: 0,
              layout: { x: 1400, y: 900, width: 250, height: 250 },
              configJson: { mode: "VARIABLE", variableKey, errorCorrection: "M" },
            },
          ],
          variableBindings: [],
        },
      },
      "diploma"
    );
  }

  function realRenderDeps(over: Record<string, unknown> = {}) {
    return {
      checkAccess: () => {},
      loadRegistration: async () => registration,
      resolvePhoto: async () => null,
      // renderPng deliberadamente ausente: sin fijarlo, resolveDeps cae en defaultRenderPng.
      ...over,
    };
  }

  it("dibuja un PNG real cuando el QR apunta a una variable con valor", async () => {
    const out = await renderDiplomaPreview(
      { registrationId: "reg_1", actor: { kind: "admin" } },
      realRenderDeps({
        resolveTemplate: async () => ({
          ok: true as const,
          preset: presetConQr("diploma.verificationUrl"),
          source: {
            templateId: "t1",
            templateName: "Con QR",
            versionId: "v1",
            versionNumber: 1,
            revision: 1,
          },
          usesParticipantPhoto: false,
        }),
      })
    );

    assert.equal(out.ok, true, out.ok === false ? out.issues.join(" · ") : "");
    assert.equal(out.ok === true && Buffer.isBuffer(out.png), true);
    // Firma PNG: si el motor no llegó a dibujar nada, ni la cabecera está.
    const firma = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    assert.ok(out.ok === true && out.png.subarray(0, 8).equals(firma));
  });

  it("sin ese dato, el motor rechaza el QR en vez de imprimir uno sin destino", async () => {
    const out = await renderDiplomaPreview(
      { registrationId: "reg_1", actor: { kind: "admin" } },
      realRenderDeps({
        resolveTemplate: async () => ({
          ok: true as const,
          // Ninguna variable con este nombre existe en los datos del diploma.
          preset: presetConQr("variable.que.no.existe"),
          source: {
            templateId: "t1",
            templateName: "Con QR",
            versionId: "v1",
            versionNumber: 1,
            revision: 1,
          },
          usesParticipantPhoto: false,
        }),
      })
    );

    assert.equal(out.ok, false);
    assert.ok(
      out.ok === false && out.issues.some((i) => i.includes("quedaría vacío")),
      out.ok === false ? out.issues.join(" · ") : ""
    );
  });
});
