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
import { DIPLOMA_ERROR_MESSAGES } from "@/lib/diplomas/diploma-types";
import { templateV2ToCardPreset } from "@/lib/participant-cards/participant-card-template-source";
import {
  PNG_1754x1240_FIXTURE,
  inscripcionAcreditada,
} from "@/lib/diplomas/__tests__/fixtures";

const deps = (over: Record<string, unknown> = {}) => ({
  checkAccess: () => {},
  loadRegistration: async () => inscripcionAcreditada(),
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
  saveToStorage: async () => ({
    storageKey: "k1",
    publicUrl: null,
    bytes: 3,
    contentHash: "hash-del-png",
  }),
  upsertCard: async () => ({ id: "card_1" }),
  persistPngAsset: async () => "asset_png_1",
  attachPngToCard: async () => {},
  markOtherCardsStale: async () => {},
  findExistingIssue: async () => null,
  createIssue: async (data: Record<string, unknown>) => ({ id: "dip_1", ...data }),
  updateIssue: async (data: Record<string, unknown>) => ({ id: "dip_1", ...data }),
  ...over,
});

describe("issueDiploma", () => {
  it("emite el diploma de un acreditado", async () => {
    const out = await issueDiploma({ registrationId: "reg_1", actor: { kind: "admin" } }, deps());
    assert.equal(out.ok, true);
    assert.match(out.ok === true ? out.diplomaCode : "", /^DIP-[A-Z0-9]{6}-CK1-0042$/);
    assert.ok(out.ok === true && out.verificationToken.length >= 24);
  });

  it("no emite si el participante no está acreditado", async () => {
    const out = await issueDiploma(
      { registrationId: "reg_1", actor: { kind: "admin" } },
      deps({
        loadRegistration: async () => inscripcionAcreditada({ checkIns: [] }),
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
        loadRegistration: async () => inscripcionAcreditada({ checkIns: [] }),
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
        loadRegistration: async () => inscripcionAcreditada({ profilePhotoAssetId: "photo_1" }),
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
        loadRegistration: async () => inscripcionAcreditada({ profilePhotoAssetId: "photo_1" }),
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
    assert.match(out.ok === true ? out.diplomaCode : "", /^DIP-[A-Z0-9]{6}-CK1-0042$/);
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

  describe("PDF del diploma", () => {
    it("un fallo generando o guardando el PDF no rompe la emisión (el PNG ya quedó bien)", async () => {
      const out = await issueDiploma(
        { registrationId: "reg_1", actor: { kind: "admin" } },
        deps({
          // El PNG que "renderPng" devuelve en los tests no es un PNG de
          // verdad (es sólo `Buffer.from("png")`): buildPdf va a fallar al
          // decodificarlo. Eso no puede tirar abajo la emisión.
          attachPdfToCard: () => {
            throw new Error("no debería llegar acá si buildPdf ya explotó");
          },
        })
      );
      assert.equal(out.ok, true);
    });

    it("con un PNG real, arma el PDF y lo deja pegado a la pieza", async () => {
      let attachCalls = 0;
      let attachedCardId = "";
      let attachedPdfAssetId = "";
      let attachedPdfStorageKey = "";
      const out = await issueDiploma(
        { registrationId: "reg_1", actor: { kind: "admin" } },
        deps({
          renderPng: async () => ({
            png: PNG_1754x1240_FIXTURE,
            width: 1754,
            height: 1240,
            durationMs: 10,
          }),
          savePdfToStorage: async (input: { storageKey: string }) => ({
            storageKey: input.storageKey,
            publicUrl: null,
          }),
          persistPdfAsset: async () => "pdf_asset_1",
          attachPdfToCard: async (input: {
            cardId: string;
            pdfAssetId: string;
            pdfStorageKey: string;
          }) => {
            attachCalls += 1;
            attachedCardId = input.cardId;
            attachedPdfAssetId = input.pdfAssetId;
            attachedPdfStorageKey = input.pdfStorageKey;
          },
        })
      );
      assert.equal(out.ok, true);
      assert.equal(out.ok === true && out.cardId, "card_1");
      assert.equal(attachCalls, 1);
      assert.equal(attachedCardId, "card_1");
      assert.equal(attachedPdfAssetId, "pdf_asset_1");
      assert.ok(attachedPdfStorageKey.endsWith(".pdf"));
    });

    it("si falla guardando el PDF (storage caído), la emisión igual queda ok", async () => {
      const out = await issueDiploma(
        { registrationId: "reg_1", actor: { kind: "admin" } },
        deps({
          renderPng: async () => ({
            png: PNG_1754x1240_FIXTURE,
            width: 1754,
            height: 1240,
            durationMs: 10,
          }),
          savePdfToStorage: async () => {
            throw new Error("R2 no disponible");
          },
        })
      );
      assert.equal(out.ok, true);
    });
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
        loadRegistration: async () => inscripcionAcreditada({ checkIns: [] }),
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
  const registration = inscripcionAcreditada();

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

/**
 * Lo que el diploma le pasa al motor de dibujo.
 *
 * El armado propio que tenía antes entregaba 13 variables contra las ~40 del
 * camino de las placas, pero el diseñador visual ofrece las 58 del catálogo
 * para cualquier plantilla y la validación sólo mira que existan en el
 * catálogo. Resultado: la fecha del evento (obligatoria) no dejaba emitir
 * NINGÚN diploma y el resto salía en blanco sin aviso.
 */
describe("issueDiploma: las variables de las placas llegan al diploma", () => {
  async function datosVistosPorElRender(): Promise<Record<string, unknown>> {
    let vistos: Record<string, unknown> = {};
    const out = await issueDiploma(
      { registrationId: "reg_1", actor: { kind: "admin" } },
      deps({
        renderPng: async (input: DiplomaRenderPngInput) => {
          vistos = input.templateData;
          return { png: Buffer.from("png"), width: 1754, height: 1240, durationMs: 1 };
        },
      })
    );
    assert.equal(out.ok, true, out.ok === false ? out.issues.join(" · ") : "");
    return vistos;
  }

  it("entrega la fecha del evento, que es el dato más esperable de un diploma", async () => {
    const data = await datosVistosPorElRender();
    assert.equal(data["edition.eventDate"], "2026-09-19");
    assert.ok(String(data["edition.eventDateFormatted"] ?? "").length > 0);
  });

  it("entrega número de participante, ciudad, sede, categoría e Instagram", async () => {
    const data = await datosVistosPorElRender();
    assert.equal(data["participant.number"], 42);
    assert.equal(data["participant.numberFormatted"], "0042");
    assert.equal(data["participant.city"], "Córdoba");
    assert.equal(data["edition.venue"], "Paseo del Buen Pastor");
    assert.equal(data["participant.category"], "General");
    assert.equal(data["participant.instagram"], "ana");
  });

  it("entrega la marca (logo y colores), que una placa ya tenía", async () => {
    const data = await datosVistosPorElRender();
    assert.ok(String(data["branding.logo"] ?? "").startsWith("data:"));
    assert.equal(data["branding.primaryColor"], "#FFE600");
  });

  it("sigue entregando las cuatro variables propias del diploma", async () => {
    const data = await datosVistosPorElRender();
    assert.match(String(data["diploma.code"]), /^DIP-/);
    assert.ok(String(data["diploma.issuedAtFormatted"] ?? "").length > 0);
    assert.ok(String(data["diploma.accreditedAtFormatted"] ?? "").length > 0);
    assert.match(String(data["diploma.verificationUrl"]), /\/diplomas\/verificar\//);
  });

  it("edition.id vale lo mismo que en las placas (el slug), no el id interno", async () => {
    const data = await datosVistosPorElRender();
    assert.equal(data["edition.id"], "dia-del-fotografo-2026");
  });
});

/**
 * La prueba de fondo del punto anterior: sin doble de `renderPng`, con el
 * motor real. Antes del arreglo, una plantilla con la fecha del evento
 * terminaba en `DIPLOMA_TEMPLATE_INVALID` ("dato obligatorio ausente") y el
 * lote la reintentaba cinco veces hasta dejarla fallida.
 */
describe("issueDiploma con el motor real: una plantilla con variables de placa emite", () => {
  function presetConVariable(variableKey: string) {
    return templateV2ToCardPreset(
      {
        templateId: "tpl_fecha",
        templateName: "Diploma con fecha",
        versionId: "v1",
        versionNumber: 1,
        revision: 1,
        payload: {
          canvas: { width: 1754, height: 1240 },
          blocks: [
            {
              id: "txt1",
              type: "VARIABLE_TEXT",
              name: "Fecha del evento",
              pageIndex: 0,
              layout: { x: 100, y: 100, width: 900, height: 120 },
              configJson: { variableKey, fontSize: 48, color: "#000000" },
            },
          ],
          variableBindings: [],
        },
      },
      "diploma"
    );
  }

  /** El `deps()` de arriba sin `renderPng`: así `resolveDeps` cae en el dibujo real. */
  function depsConMotorReal(variableKey: string) {
    const base = deps() as Record<string, unknown>;
    delete base.renderPng;
    return {
      ...base,
      resolveTemplate: async () => ({
        ok: true as const,
        preset: presetConVariable(variableKey),
        source: {
          templateId: "tpl_fecha",
          templateName: "Diploma con fecha",
          versionId: "v1",
          versionNumber: 1,
          revision: 1,
        },
        usesParticipantPhoto: false,
      }),
    };
  }

  it("emite con edition.eventDate, que el catálogo declara obligatoria", async () => {
    const out = await issueDiploma(
      { registrationId: "reg_1", actor: { kind: "admin" } },
      depsConMotorReal("edition.eventDate")
    );
    assert.equal(out.ok, true, out.ok === false ? out.issues.join(" · ") : "");
  });

  it("emite con participant.numberFormatted, que el armado viejo no proveía", async () => {
    const out = await issueDiploma(
      { registrationId: "reg_1", actor: { kind: "admin" } },
      depsConMotorReal("participant.numberFormatted")
    );
    assert.equal(out.ok, true, out.ok === false ? out.issues.join(" · ") : "");
  });
});

/**
 * El PNG del diploma tiene que dar de alta su `DnxMediaAsset` igual que las
 * placas: la ruta del ZIP filtra por `assetId: { not: null }`, así que sin
 * eso los dos botones de descarga del panel devuelven 404 siempre.
 */
describe("issueDiploma: la imagen queda registrada como asset", () => {
  it("da de alta el asset del PNG y lo engancha a la pieza", async () => {
    let assetDe: string | null = null;
    let enganchado: { cardId: string; assetId: string } | null = null;
    const out = await issueDiploma(
      { registrationId: "reg_1", actor: { kind: "admin" } },
      deps({
        upsertCard: async () => ({ id: "card_42" }),
        persistPngAsset: async (input: { cardId: string }) => {
          assetDe = input.cardId;
          return "asset_del_png";
        },
        attachPngToCard: async (input: { cardId: string; assetId: string }) => {
          enganchado = input;
        },
      })
    );
    assert.equal(out.ok, true);
    assert.equal(assetDe, "card_42");
    assert.deepEqual(enganchado, { cardId: "card_42", assetId: "asset_del_png" });
  });

  it("la fila de la pieza guarda tamaño y huella del archivo", async () => {
    const vistos: Record<string, unknown>[] = [];
    await issueDiploma(
      { registrationId: "reg_1", actor: { kind: "admin" } },
      deps({
        saveToStorage: async () => ({
          storageKey: "k1",
          publicUrl: null,
          bytes: 12345,
          contentHash: "abc123",
        }),
        upsertCard: async (input: Record<string, unknown>) => {
          vistos.push(input);
          return { id: "card_1" };
        },
      })
    );
    assert.equal(vistos[0]?.byteSize, 12345);
    assert.equal(vistos[0]?.contentHash, "abc123");
  });

  it("al rehacer, la pieza anterior queda STALE para que el ZIP no la baje dos veces", async () => {
    let marcado: { registrationId: string; exceptCardId: string } | null = null;
    const out = await issueDiploma(
      { registrationId: "reg_1", actor: { kind: "admin" } },
      deps({
        findExistingIssue: async () => ({
          id: "dip_previo",
          diplomaCode: "DIP-AAAAAA-CK1-0042",
          verificationToken: "token-viejo-que-no-cambia-xx",
          issuedAt: new Date("2026-08-01T12:00:00Z"),
          cardId: "card_viejo",
          revokedAt: null,
        }),
        upsertCard: async () => ({ id: "card_nuevo" }),
        markOtherCardsStale: async (input: {
          registrationId: string;
          exceptCardId: string;
        }) => {
          marcado = input;
        },
      })
    );
    assert.equal(out.ok, true);
    assert.deepEqual(marcado, { registrationId: "reg_1", exceptCardId: "card_nuevo" });
  });

  it("si el alta del asset falla, la emisión falla (no se traga como el PDF)", async () => {
    let emisiones = 0;
    const out = await issueDiploma(
      { registrationId: "reg_1", actor: { kind: "admin" } },
      deps({
        persistPngAsset: async () => {
          throw new Error("base caída");
        },
        createIssue: async (data: Record<string, unknown>) => {
          emisiones += 1;
          return { id: "dip_1", ...data };
        },
      })
    );
    assert.equal(out.ok, false);
    assert.equal(out.ok === false && out.code, "DIPLOMA_ISSUE_FAILED");
    assert.equal(emisiones, 0, "no se quema el código ni el token si el asset no quedó");
  });
});

/**
 * La imagen del diploma se sirve públicamente (para que se vea dentro del
 * correo) y viaja adjunta: si la plantilla usa la foto, hace falta el
 * consentimiento de imagen, con el mismo criterio que las placas.
 */
describe("issueDiploma: consentimiento de imagen", () => {
  const plantillaConFoto = {
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
  };

  /** Ningún proxy de consentimiento presente (ver `hasClickatonCardConsent`). */
  const sinConsentimiento = {
    profilePhotoAssetId: "photo_1",
    imageUsageConsent: false,
    acceptedImageAt: null,
    acceptedTermsAt: null,
    termsAcceptedAt: null,
  };

  it("sin consentimiento no se emite, y no se dibuja nada", async () => {
    let dibujos = 0;
    const out = await issueDiploma(
      { registrationId: "reg_1", actor: { kind: "admin" } },
      deps({
        loadRegistration: async () => inscripcionAcreditada(sinConsentimiento),
        resolveTemplate: async () => plantillaConFoto,
        renderPng: async () => {
          dibujos += 1;
          return { png: Buffer.from("x"), width: 1, height: 1, durationMs: 1 };
        },
      })
    );
    assert.equal(out.ok === false && out.code, "DIPLOMA_PHOTO_CONSENT_MISSING");
    assert.equal(dibujos, 0);
  });

  it("el motivo se explica en castellano", () => {
    assert.match(
      DIPLOMA_ERROR_MESSAGES.DIPLOMA_PHOTO_CONSENT_MISSING,
      /consentimiento de imagen/i
    );
  });

  it("con consentimiento (aunque sea por las bases aceptadas) sí se emite", async () => {
    const out = await issueDiploma(
      { registrationId: "reg_1", actor: { kind: "admin" } },
      deps({
        loadRegistration: async () =>
          inscripcionAcreditada({
            ...sinConsentimiento,
            termsAcceptedAt: new Date("2026-09-01T10:00:00Z"),
          }),
        resolveTemplate: async () => plantillaConFoto,
        resolvePhoto: async () => "data:image/png;base64,Zm90bw==",
      })
    );
    assert.equal(out.ok, true, out.ok === false ? out.issues.join(" · ") : "");
  });

  it("si la plantilla NO usa la foto, el consentimiento no bloquea nada", async () => {
    const out = await issueDiploma(
      { registrationId: "reg_1", actor: { kind: "admin" } },
      deps({ loadRegistration: async () => inscripcionAcreditada(sinConsentimiento) })
    );
    assert.equal(out.ok, true);
  });
});
