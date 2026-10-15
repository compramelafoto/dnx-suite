/**
 * Emisor del diploma de participación.
 *
 * Orquesta, en orden, y corta ante el primer problema sin dibujar nada:
 * 0. Autorización del actor (sólo admin).
 * 1. Carga la inscripción (con check-ins y edición).
 * 2. Acreditación vigente (no mira el pago).
 * 3. Plantilla del diploma (Task 4) — si no resuelve, listo, no se renderiza.
 * 4. Foto del participante, sólo si la plantilla la usa — y sólo con su
 *    consentimiento de imagen, igual que las placas.
 * 5. Código, token y fecha de emisión: si ya hay un diploma vigente para la
 *    inscripción, se reusan los tres (`reused: true`); si no, se generan
 *    (Task 5) y la fecha de emisión es la de hoy. Un diploma revocado NO
 *    cuenta como vigente: se emite uno nuevo, con código y token propios.
 * 6. Render, guardado en storage, alta del `DnxMediaAsset` de la imagen (sin
 *    eso el diploma no entra a ninguna descarga en ZIP) y persistencia de la
 *    pieza y del emisor.
 *
 * Cualquier falla —conocida o no— termina en `{ ok: false, code, issues }`,
 * nunca en una excepción cruda: `DiplomaServiceError` lleva el código de la
 * lista conocida (`DiplomaErrorCode`); cualquier otra excepción cae en
 * `DIPLOMA_ISSUE_FAILED`.
 *
 * No reutiliza `generateClickatonParticipantCard` / `getOrGenerateClickatonParticipantCard`:
 * el diploma resuelve su propia plantilla (sin preset de respaldo) y no tiene el
 * cache-por-render-hash ni el locking de las placas welcome/member. Mezclarlo
 * hubiera significado tocar ese pipeline (que hoy funciona en producción) para
 * algo que el diploma no necesita.
 */
import { createHash } from "node:crypto";
import { prisma } from "@/lib/admin/db";
import {
  CLICKATON_DEFAULT_TIMEZONE,
  clickatonTemplateVariablesPlugin,
  createTemplateVariableRegistry,
  formatDateShort,
  formatDateWithTime,
  fromLegacyTemplateV2,
  parseTemplateDocument,
  resolveTemplateDocument,
  type ResolvedTemplateDocument,
} from "@repo/template-engine";
import { resolveClickatonPublicOrigin } from "@/lib/site/public-origin";
import { isAccredited } from "./diploma-eligibility";
import { resolveDiplomaTemplate } from "./diploma-template";
import { buildDiplomaCode, generateVerificationToken } from "./diploma-code";
import { A4_LANDSCAPE_PT, buildDiplomaPdf } from "./diploma-pdf";
import type { DiplomaErrorCode } from "./diploma-types";
import { buildParticipantCardStorageKey } from "../participant-cards/participant-card-r2-keys";
import { resolveParticipantCardRenderProvider } from "../participant-cards/participant-card-render-provider";
import {
  createParticipantCardAssetStore,
  persistParticipantCardMediaAsset,
} from "../participant-cards/participant-card-asset-store";
import { buildClickatonParticipantTemplateData } from "../participant-cards/participant-card-data";
import { hasClickatonCardConsent } from "../participant-cards/participant-card-consent";
import { renderHashPrefix } from "../participant-cards/participant-card-hash";
import { PARTICIPANT_CARD_REGISTRATION_SELECT } from "../participant-cards/participant-card-persistence";
import { resolveParticipantPhotoDataUrl } from "../participant-cards/participant-card-photo";
import { requireParticipantCardAdminAccess } from "../participant-cards/participant-card-authorization";
import { CLICKATON_CARD_RENDERER_VERSION } from "../participant-cards/participant-card-renderer-version";
import {
  instantiatePresetPayload,
  type ClickatonCardPreset,
} from "../participant-cards/participant-card-presets";
import type {
  ParticipantCardActor,
  ParticipantCardRegistrationSnapshot,
} from "../participant-cards/participant-card-types";

/**
 * La inscripción, tal como la ve el diploma: EXACTAMENTE la misma foto que
 * usan las placas de bienvenida y "Soy parte" (`ParticipantCardRegistrationSnapshot`)
 * más el `editionId` y los check-ins que el diploma necesita para la
 * acreditación.
 *
 * Es deliberado que sea la misma y no una reducida: el diseñador visual
 * ofrece las 58 variables del catálogo para CUALQUIER plantilla y la
 * validación sólo comprueba que la variable exista en el catálogo, no que el
 * camino del diploma la provea. Con una foto más chica, una plantilla que
 * usara la fecha del evento no emitía ningún diploma y el resto de las
 * variables (número de participante, ciudad, sede, marca, categoría,
 * Instagram) salían impresas en blanco y sin aviso.
 */
export type DiplomaRegistrationSnapshot = ParticipantCardRegistrationSnapshot & {
  editionId: string;
  checkIns: Array<{ checkedInAt: Date; reversedAt: Date | null }>;
};

/**
 * Resultado de resolver la plantilla, tal como lo consume este servicio.
 * `preset` se pasa opaco a `renderPng`: acá nunca se lee su forma interna,
 * así que puede ser el `ClickatonCardPreset` real o, en los tests, cualquier
 * valor de reemplazo.
 */
export type DiplomaTemplateResolution =
  | {
      ok: true;
      preset: unknown;
      source: {
        templateId: string;
        templateName: string;
        versionId: string;
        versionNumber: number;
        revision: number;
      };
      usesParticipantPhoto: boolean;
    }
  | { ok: false; code: DiplomaErrorCode; issues: string[] };

export type DiplomaIssueExisting = {
  id: string;
  diplomaCode: string;
  verificationToken: string;
  /** Fecha de emisión original: se conserva siempre que se reusa el diploma. */
  issuedAt: Date;
  cardId: string | null;
  revokedAt: Date | null;
};

/** Forma laxa: el llamador sólo necesita el `id`, el resto queda a disposición de quien lo use. */
export type DiplomaIssueWriteResult = { id: string } & Record<string, unknown>;

export type DiplomaCreateIssueInput = {
  registrationId: string;
  editionId: string;
  cardId: string;
  diplomaCode: string;
  verificationToken: string;
  issuedAt: Date;
};

export type DiplomaUpdateIssueInput = {
  id: string;
  cardId: string;
  editionId: string;
};

export type DiplomaRenderPngInput = {
  preset: unknown;
  templateData: Record<string, unknown>;
};

export type DiplomaRenderPngResult = {
  png: Buffer;
  width: number;
  height: number;
  durationMs: number;
};

export type DiplomaSaveToStorageInput = {
  storageKey: string;
  png: Buffer;
  width: number;
  height: number;
  templateKey: string;
  templateVersion: number;
};

export type DiplomaSaveToStorageResult = {
  storageKey: string;
  publicUrl: string | null;
  /** Tamaño del archivo subido: va a la fila de la pieza (`byteSize`). */
  bytes: number;
  /** Huella del contenido subido: va a la fila de la pieza (`contentHash`). */
  contentHash: string;
};

export type DiplomaUpsertCardInput = {
  registrationId: string;
  editionId: string;
  storageKey: string;
  width: number;
  height: number;
  templateKey: string;
  templateVersion: number;
  renderHash: string;
  byteSize: number;
  contentHash: string;
};

/**
 * Alta del `DnxMediaAsset` del PNG del diploma, el mismo registro que dan de
 * alta las placas al guardar su imagen.
 *
 * No es un detalle contable: la descarga masiva
 * (`app/api/admin/ediciones/[editionId]/placas/descargar/route.ts`) filtra
 * por `assetId: { not: null }`, así que una pieza sin su asset registrado
 * NUNCA entra al ZIP. Mientras el diploma no lo daba de alta, los dos
 * botones de descarga del panel devolvían 404 siempre.
 */
export type DiplomaPersistPngAssetInput = {
  cardId: string;
  editionId: string;
  registrationId: string;
  storageKey: string;
  publicUrl: string | null;
  png: Buffer;
  width: number;
  height: number;
  templateKey: string;
  templateVersion: number;
  renderHash: string;
};

export type DiplomaAttachPngInput = {
  cardId: string;
  assetId: string;
};

export type DiplomaMarkOtherCardsStaleInput = {
  registrationId: string;
  exceptCardId: string;
};

export type DiplomaSavePdfInput = {
  storageKey: string;
  pdf: Buffer;
  templateKey: string;
  templateVersion: number;
};

export type DiplomaSavePdfResult = {
  storageKey: string;
  publicUrl: string | null;
};

export type DiplomaPersistPdfAssetInput = {
  cardId: string;
  editionId: string;
  registrationId: string;
  storageKey: string;
  publicUrl: string | null;
  pdf: Buffer;
};

export type DiplomaAttachPdfInput = {
  cardId: string;
  pdfAssetId: string;
  pdfStorageKey: string;
};

export type DiplomaResolvePhotoInput = { profilePhotoAssetId: string };

export type DiplomaServiceDeps = {
  /** Sólo admin puede emitir diplomas. Default: la autorización real de placas. */
  checkAccess?: (actor: ParticipantCardActor) => void;
  loadRegistration?: (
    registrationId: string
  ) => Promise<DiplomaRegistrationSnapshot | null>;
  resolveTemplate?: (input: {
    editionId: string;
  }) => Promise<DiplomaTemplateResolution>;
  resolvePhoto?: (input: DiplomaResolvePhotoInput) => Promise<string | null>;
  renderPng?: (input: DiplomaRenderPngInput) => Promise<DiplomaRenderPngResult>;
  saveToStorage?: (
    input: DiplomaSaveToStorageInput
  ) => Promise<DiplomaSaveToStorageResult>;
  upsertCard?: (input: DiplomaUpsertCardInput) => Promise<{ id: string }>;
  /**
   * Alta del `DnxMediaAsset` del PNG y su enganche a la pieza. NO es "mejor
   * esfuerzo" como el PDF: sin el asset registrado, el diploma no entra a
   * ninguna descarga en ZIP. Si falla, la emisión falla y se reintenta.
   */
  persistPngAsset?: (input: DiplomaPersistPngAssetInput) => Promise<string>;
  attachPngToCard?: (input: DiplomaAttachPngInput) => Promise<void>;
  /**
   * Deja `STALE` a las piezas de diploma anteriores de esa inscripción, igual
   * que hacen las placas (`markOtherReadyAsStale`). Sin esto, rehacer un
   * diploma con otra plantilla deja DOS filas `READY` y la descarga en ZIP
   * baja el diploma de esa persona dos veces.
   */
  markOtherCardsStale?: (input: DiplomaMarkOtherCardsStaleInput) => Promise<void>;
  /**
   * PDF imprimible del diploma. Mejor esfuerzo: `issueDiploma` nunca deja
   * que un fallo acá (de `buildPdf`, `savePdfToStorage` o `persistPdfAsset`)
   * tire abajo una emisión — ver `attachDiplomaPdfBestEffort`.
   */
  buildPdf?: (png: Buffer) => Promise<Buffer>;
  savePdfToStorage?: (input: DiplomaSavePdfInput) => Promise<DiplomaSavePdfResult>;
  persistPdfAsset?: (input: DiplomaPersistPdfAssetInput) => Promise<string>;
  attachPdfToCard?: (input: DiplomaAttachPdfInput) => Promise<void>;
  findExistingIssue?: (input: {
    registrationId: string;
  }) => Promise<DiplomaIssueExisting | null>;
  createIssue?: (data: DiplomaCreateIssueInput) => Promise<DiplomaIssueWriteResult>;
  updateIssue?: (data: DiplomaUpdateIssueInput) => Promise<DiplomaIssueWriteResult>;
  now?: () => Date;
};

export type IssueDiplomaResult =
  | {
      ok: true;
      diplomaId: string;
      diplomaCode: string;
      verificationToken: string;
      cardId: string;
      storageKey: string;
      reused: boolean;
      /**
       * `true` si el PDF imprimible quedó adjunto a la pieza. El PDF es
       * "mejor esfuerzo" (nunca tira abajo una emisión), así que sin esta
       * marca un PDF que falla sistemáticamente en producción no dejaba
       * ninguna señal: el resultado decía `ok: true` igual.
       */
      pdfAttached: boolean;
    }
  | { ok: false; code: DiplomaErrorCode; issues: string[] };

/** Cualquier motivo de falla conocido, con el código de `DiplomaErrorCode` que le corresponde. */
export class DiplomaServiceError extends Error {
  readonly code: DiplomaErrorCode;
  readonly issues: string[];

  constructor(code: DiplomaErrorCode, issues: string[] = [], message?: string) {
    super(message ?? code);
    this.name = "DiplomaServiceError";
    this.code = code;
    this.issues = issues;
  }
}

/**
 * Dos pedidos de emisión a la vez (doble clic) chocan contra la unicidad de
 * la base (código, token, o el índice parcial "un vigente por inscripción").
 * `issueDiploma` la atrapa y devuelve el diploma que ganó la carrera en vez
 * de reventar con el error crudo de Prisma.
 */
export class DiplomaUniqueViolationError extends Error {
  readonly code = "P2002" as const;
  constructor() {
    super("Diploma unique constraint violation");
    this.name = "DiplomaUniqueViolationError";
  }
}

function isPrismaUniqueViolation(err: unknown): boolean {
  return Boolean(
    err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: unknown }).code === "P2002"
  );
}

/**
 * Los mismos campos que carga el camino de las placas
 * (`PARTICIPANT_CARD_REGISTRATION_SELECT`) más los check-ins de la
 * acreditación. Se reusa la lista compartida a propósito: si el diploma
 * tuviera la suya, cualquier variable nueva de plantilla quedaría en blanco
 * sólo en el diploma y nadie se enteraría hasta verlo impreso.
 */
const REGISTRATION_SELECT = {
  ...PARTICIPANT_CARD_REGISTRATION_SELECT,
  checkIns: {
    where: { reversedAt: null },
    select: { checkedInAt: true, reversedAt: true },
    orderBy: { checkedInAt: "asc" },
  },
} as const;

async function defaultLoadRegistration(
  registrationId: string
): Promise<DiplomaRegistrationSnapshot | null> {
  const row = await prisma.clickatonRegistration.findUnique({
    where: { id: registrationId },
    select: REGISTRATION_SELECT,
  });
  return row ?? null;
}

async function defaultResolvePhoto(
  input: DiplomaResolvePhotoInput
): Promise<string | null> {
  return resolveParticipantPhotoDataUrl(input.profilePhotoAssetId);
}

/**
 * Resolución de documento propia del diploma (no la de
 * `resolveClickatonParticipantCardDocument`, compartida con welcome/member):
 * acá una variable sin resolver corta la emisión en vez de quedar como
 * advertencia y salir impresa tal cual (`{{diploma.code}}`) en el PNG.
 */
function resolveDiplomaDocument(input: {
  preset: ClickatonCardPreset;
  templateData: Record<string, unknown>;
}): ResolvedTemplateDocument {
  const legacyPayload = instantiatePresetPayload(input.preset);
  const bridged = fromLegacyTemplateV2(legacyPayload, {
    id: input.preset.presetId,
    name: input.preset.name,
  });

  const parsed = parseTemplateDocument(bridged.document);
  if (!parsed.ok) {
    throw new DiplomaServiceError("DIPLOMA_TEMPLATE_INVALID", [
      parsed.error,
      ...(parsed.issues ?? []),
    ]);
  }

  const registry = createTemplateVariableRegistry({
    plugins: [clickatonTemplateVariablesPlugin],
  });

  const resolved = resolveTemplateDocument({
    template: parsed.data,
    data: input.templateData,
    registry,
  });

  if (resolved.errors.length > 0) {
    throw new DiplomaServiceError(
      "DIPLOMA_TEMPLATE_INVALID",
      resolved.errors.map((e) => e.message)
    );
  }

  // Para welcome/member una variable desconocida es sólo una advertencia: el
  // motor deja `{{...}}` literal en el PNG y sigue. Para un diploma eso es
  // peor que no emitirlo (código y token quedarían quemados con un archivo
  // ilegible), así que acá corta.
  const sinResolver = resolved.warnings.filter((w) => w.code === "unknown_variable");
  if (sinResolver.length > 0) {
    throw new DiplomaServiceError(
      "DIPLOMA_TEMPLATE_INVALID",
      sinResolver.map((w) => w.message)
    );
  }

  return resolved.document;
}

async function defaultRenderPng(
  input: DiplomaRenderPngInput
): Promise<DiplomaRenderPngResult> {
  const preset = input.preset as ClickatonCardPreset;
  const document = resolveDiplomaDocument({ preset, templateData: input.templateData });
  const provider = resolveParticipantCardRenderProvider();
  return provider.render({ document, templateData: input.templateData });
}

async function defaultSaveToStorage(
  input: DiplomaSaveToStorageInput
): Promise<DiplomaSaveToStorageResult> {
  const store = createParticipantCardAssetStore();
  const renderHashPrefix = input.storageKey.split("/").pop()?.split(".")[0] ?? "";
  const stored = await store.putAtKey(input.storageKey, input.png, {
    cardType: "diploma",
    templateKey: input.templateKey,
    templateVersion: input.templateVersion,
    renderHashPrefix,
    width: input.width,
    height: input.height,
    mimeType: "image/png",
    generatedAt: new Date().toISOString(),
  });
  return {
    storageKey: stored.key,
    publicUrl: stored.publicUrl,
    bytes: stored.bytes,
    contentHash: stored.contentHash,
  };
}

async function defaultUpsertCard(
  input: DiplomaUpsertCardInput
): Promise<{ id: string }> {
  const now = new Date();
  const existingRow = await prisma.clickatonParticipantCard.findFirst({
    where: {
      registrationId: input.registrationId,
      cardType: "DIPLOMA",
      renderHash: input.renderHash,
    },
    select: { id: true },
  });

  if (existingRow) {
    await prisma.clickatonParticipantCard.update({
      where: { id: existingRow.id },
      data: {
        status: "READY",
        storageKey: input.storageKey,
        width: input.width,
        height: input.height,
        byteSize: input.byteSize,
        contentHash: input.contentHash,
        generatedAt: now,
        updatedAt: now,
      },
    });
    return { id: existingRow.id };
  }

  try {
    const created = await prisma.clickatonParticipantCard.create({
      data: {
        registrationId: input.registrationId,
        editionId: input.editionId,
        cardType: "DIPLOMA",
        templateKey: input.templateKey,
        templateVersion: input.templateVersion,
        rendererVersion: CLICKATON_CARD_RENDERER_VERSION,
        renderHash: input.renderHash,
        status: "READY",
        storageKey: input.storageKey,
        width: input.width,
        height: input.height,
        byteSize: input.byteSize,
        contentHash: input.contentHash,
        mimeType: "image/png",
        startedAt: now,
        generatedAt: now,
      },
    });
    return { id: created.id };
  } catch (err) {
    if (isPrismaUniqueViolation(err)) throw new DiplomaUniqueViolationError();
    throw err;
  }
}

/**
 * Da de alta (o actualiza) el `DnxMediaAsset` del PNG reusando la MISMA
 * función que las placas (`persistParticipantCardMediaAsset`): mismo criterio
 * anti-duplicado por `storageKey`, mismo `kind` (`PARTICIPANT_CARD_PNG`),
 * misma forma de guardar el contenido en línea cuando el backend es
 * `KEY_ONLY`. No se duplica la lógica acá.
 */
async function defaultPersistPngAsset(
  input: DiplomaPersistPngAssetInput
): Promise<string> {
  const store = createParticipantCardAssetStore();
  return persistParticipantCardMediaAsset({
    cardRecordId: input.cardId,
    registrationId: input.registrationId,
    editionId: input.editionId,
    storageKey: input.storageKey,
    publicUrl: input.publicUrl,
    png: input.png,
    width: input.width,
    height: input.height,
    storageBackend: store.backend,
    templateKey: input.templateKey,
    templateVersion: input.templateVersion,
    cardType: "diploma",
    renderHashPrefix: renderHashPrefix(input.renderHash),
  });
}

async function defaultAttachPngToCard(input: DiplomaAttachPngInput): Promise<void> {
  await prisma.clickatonParticipantCard.update({
    where: { id: input.cardId },
    data: { assetId: input.assetId },
  });
}

async function defaultMarkOtherCardsStale(
  input: DiplomaMarkOtherCardsStaleInput
): Promise<void> {
  const now = new Date();
  await prisma.clickatonParticipantCard.updateMany({
    where: {
      registrationId: input.registrationId,
      cardType: "DIPLOMA",
      status: "READY",
      id: { not: input.exceptCardId },
    },
    data: { status: "STALE", updatedAt: now },
  });
}

async function defaultBuildPdf(png: Buffer): Promise<Buffer> {
  return buildDiplomaPdf(png);
}

async function defaultSavePdfToStorage(
  input: DiplomaSavePdfInput
): Promise<DiplomaSavePdfResult> {
  const store = createParticipantCardAssetStore();
  const renderHashPrefix = input.storageKey.split("/").pop()?.split(".")[0] ?? "";
  const stored = await store.putAtKey(input.storageKey, input.pdf, {
    cardType: "diploma-pdf",
    templateKey: input.templateKey,
    templateVersion: input.templateVersion,
    renderHashPrefix,
    // El diploma en sí ya guarda sus medidas de píxel en la fila del PNG:
    // acá lo único que describe al archivo es el tamaño de hoja fijo.
    width: Math.round(A4_LANDSCAPE_PT[0]),
    height: Math.round(A4_LANDSCAPE_PT[1]),
    mimeType: "application/pdf",
    generatedAt: new Date().toISOString(),
  });
  return { storageKey: stored.key, publicUrl: stored.publicUrl };
}

/**
 * Registra el PDF como `DnxMediaAsset` (kind `PARTICIPANT_CARD_PDF`).
 *
 * Mismo criterio anti-duplicado que `persistParticipantCardMediaAsset`
 * (welcome/member): la ubicación sale de la misma `renderHash` que el PNG,
 * así que regenerar el mismo diseño cae sobre el mismo registro (se
 * actualiza) en vez de chocar contra la unicidad de storage.
 */
async function defaultPersistPdfAsset(
  input: DiplomaPersistPdfAssetInput
): Promise<string> {
  const store = createParticipantCardAssetStore();
  const contentHash = createHash("sha256").update(input.pdf).digest("hex");

  const existente = await prisma.dnxMediaAsset.findFirst({
    where: { storageBackend: store.backend, storageKey: input.storageKey },
    select: { id: true },
  });

  if (existente) {
    await prisma.dnxMediaAsset.update({
      where: { id: existente.id },
      data: {
        ownerId: input.cardId,
        bytes: input.pdf.length,
        contentHash,
        publicUrl: input.publicUrl,
      },
    });
    return existente.id;
  }

  const created = await prisma.dnxMediaAsset.create({
    data: {
      platform: "CLICKATON",
      ownerType: "PARTICIPANT_CARD",
      ownerId: input.cardId,
      editionId: input.editionId,
      registrationId: input.registrationId,
      kind: "PARTICIPANT_CARD_PDF",
      storageBackend: store.backend,
      storageKey: input.storageKey,
      publicUrl: input.publicUrl,
      mimeType: "application/pdf",
      bytes: input.pdf.length,
      contentHash,
    },
  });
  return created.id;
}

async function defaultAttachPdfToCard(input: DiplomaAttachPdfInput): Promise<void> {
  await prisma.clickatonParticipantCard.update({
    where: { id: input.cardId },
    data: { pdfAssetId: input.pdfAssetId, pdfStorageKey: input.pdfStorageKey },
  });
}

async function defaultFindExistingIssue(input: {
  registrationId: string;
}): Promise<DiplomaIssueExisting | null> {
  const row = await prisma.clickatonDiplomaIssue.findFirst({
    where: { registrationId: input.registrationId, revokedAt: null },
    select: {
      id: true,
      diplomaCode: true,
      verificationToken: true,
      issuedAt: true,
      cardId: true,
      revokedAt: true,
    },
  });
  return row ?? null;
}

async function defaultCreateIssue(
  data: DiplomaCreateIssueInput
): Promise<DiplomaIssueWriteResult> {
  try {
    const created = await prisma.clickatonDiplomaIssue.create({
      data: {
        registrationId: data.registrationId,
        editionId: data.editionId,
        cardId: data.cardId,
        diplomaCode: data.diplomaCode,
        verificationToken: data.verificationToken,
        issuedAt: data.issuedAt,
      },
    });
    return created;
  } catch (err) {
    if (isPrismaUniqueViolation(err)) throw new DiplomaUniqueViolationError();
    throw err;
  }
}

async function defaultUpdateIssue(
  data: DiplomaUpdateIssueInput
): Promise<DiplomaIssueWriteResult> {
  const updated = await prisma.clickatonDiplomaIssue.update({
    where: { id: data.id },
    data: { cardId: data.cardId, editionId: data.editionId },
  });
  return updated;
}

function resolveDeps(deps: DiplomaServiceDeps) {
  return {
    checkAccess: deps.checkAccess ?? requireParticipantCardAdminAccess,
    loadRegistration: deps.loadRegistration ?? defaultLoadRegistration,
    resolveTemplate: deps.resolveTemplate ?? resolveDiplomaTemplate,
    resolvePhoto: deps.resolvePhoto ?? defaultResolvePhoto,
    renderPng: deps.renderPng ?? defaultRenderPng,
    saveToStorage: deps.saveToStorage ?? defaultSaveToStorage,
    upsertCard: deps.upsertCard ?? defaultUpsertCard,
    persistPngAsset: deps.persistPngAsset ?? defaultPersistPngAsset,
    attachPngToCard: deps.attachPngToCard ?? defaultAttachPngToCard,
    markOtherCardsStale: deps.markOtherCardsStale ?? defaultMarkOtherCardsStale,
    buildPdf: deps.buildPdf ?? defaultBuildPdf,
    savePdfToStorage: deps.savePdfToStorage ?? defaultSavePdfToStorage,
    persistPdfAsset: deps.persistPdfAsset ?? defaultPersistPdfAsset,
    attachPdfToCard: deps.attachPdfToCard ?? defaultAttachPdfToCard,
    findExistingIssue: deps.findExistingIssue ?? defaultFindExistingIssue,
    createIssue: deps.createIssue ?? defaultCreateIssue,
    updateIssue: deps.updateIssue ?? defaultUpdateIssue,
    now: deps.now ?? (() => new Date()),
  };
}

/** Primer check-in vigente (los más viejos primero, como arma `selectDiplomaCandidates`). */
function earliestAccreditedAt(
  checkIns: Array<{ checkedInAt: Date; reversedAt: Date | null }>,
  fallback: Date
): Date {
  const vigentes = checkIns
    .filter((c) => c.reversedAt === null)
    .sort((a, b) => a.checkedInAt.getTime() - b.checkedInAt.getTime());
  return vigentes[0]?.checkedInAt ?? fallback;
}

function buildDiplomaVerificationUrl(verificationToken: string): string {
  const origin = resolveClickatonPublicOrigin();
  return `${origin}/diplomas/verificar/${verificationToken}`;
}

/**
 * Datos que ve el render.
 *
 * Es el MISMO armado que usan las placas de bienvenida y "Soy parte"
 * (`buildClickatonParticipantTemplateData`) con el bloque `diploma.*`
 * superpuesto encima. No hay una segunda implementación: el diseñador visual
 * ofrece las 58 variables del catálogo para cualquier plantilla y la
 * validación sólo comprueba que existan en el catálogo, no que este camino
 * las provea — con un armado propio y más chico, una plantilla que usara
 * `edition.eventDate` (obligatoria, y el dato más esperable de un diploma de
 * participación) no emitía NINGÚN diploma, y las opcionales salían impresas
 * en blanco sin ningún aviso.
 *
 * `edition.id` queda con el valor que ya le da el armado compartido (el slug
 * de la edición, que es lo que muestra el ejemplo del catálogo): antes las
 * dos funciones no concordaban — el diploma ponía el identificador interno y
 * las placas el slug — y la misma variable imprimía cosas distintas según la
 * pieza. Se unifica sin tocar lo que ven las placas, que no pueden cambiar
 * de comportamiento.
 */
function buildDiplomaTemplateData(input: {
  registration: DiplomaRegistrationSnapshot;
  photoDataUrl: string | null;
  diplomaCode: string;
  verificationToken: string;
  accreditedAt: Date;
  issuedAt: Date;
  timezone: string;
}): Record<string, unknown> {
  const base = buildClickatonParticipantTemplateData({
    registration: input.registration,
    photoDataUrl: input.photoDataUrl ?? "",
  });

  const diploma = {
    code: input.diplomaCode,
    issuedAtFormatted: formatDateShort(input.issuedAt, input.timezone),
    accreditedAtFormatted: formatDateWithTime(input.accreditedAt, input.timezone),
    verificationUrl: buildDiplomaVerificationUrl(input.verificationToken),
  };

  // El armado compartido devuelve las variables dos veces: anidadas y
  // aplanadas por camino (`edition.name`). Las del diploma se agregan de las
  // dos formas para que el motor las resuelva igual que a las demás.
  return {
    ...base,
    diploma,
    "diploma.code": diploma.code,
    "diploma.issuedAtFormatted": diploma.issuedAtFormatted,
    "diploma.accreditedAtFormatted": diploma.accreditedAtFormatted,
    "diploma.verificationUrl": diploma.verificationUrl,
  };
}

function computeDiplomaRenderHash(input: {
  registrationId: string;
  diplomaCode: string;
  source: { templateId: string; versionId: string; versionNumber: number; revision: number };
}): string {
  const payload = JSON.stringify({
    registrationId: input.registrationId,
    diplomaCode: input.diplomaCode,
    templateId: input.source.templateId,
    versionId: input.source.versionId,
    versionNumber: input.source.versionNumber,
    revision: input.source.revision,
    // Un cambio de motor de render puede cambiar el PNG para el mismo
    // input: sin esto, la pieza cacheada queda sirviendo un dibujo viejo.
    rendererVersion: CLICKATON_CARD_RENDERER_VERSION,
  });
  return createHash("sha256").update(payload).digest("hex");
}

/**
 * Guarda la pieza del diploma (`ClickatonParticipantCard`) con su imagen ya
 * registrada como `DnxMediaAsset`, igual que hacen las placas.
 *
 * Tres escrituras en orden: la fila de la pieza (que es la que da el id que
 * el asset necesita como dueño), el alta del asset, y el enganche del
 * `assetId` en la fila. A diferencia del PDF, acá NADA es "mejor esfuerzo":
 * un fallo se propaga y la emisión se reintenta más tarde, porque una pieza
 * sin `assetId` no entra a ninguna descarga en ZIP —la ruta filtra por
 * `assetId: { not: null }`— y el respaldo por identificador de archivo del
 * lector del participante tampoco tendría a qué caer.
 */
async function persistDiplomaCardWithAsset(
  deps: ReturnType<typeof resolveDeps>,
  input: {
    upsertCardInput: DiplomaUpsertCardInput;
    png: Buffer;
    width: number;
    height: number;
    publicUrl: string | null;
    editionId: string;
    registrationId: string;
    templateKey: string;
    templateVersion: number;
    renderHash: string;
  }
): Promise<{ id: string }> {
  const card = await deps.upsertCard(input.upsertCardInput);
  const assetId = await deps.persistPngAsset({
    cardId: card.id,
    editionId: input.editionId,
    registrationId: input.registrationId,
    storageKey: input.upsertCardInput.storageKey,
    publicUrl: input.publicUrl,
    png: input.png,
    width: input.width,
    height: input.height,
    templateKey: input.templateKey,
    templateVersion: input.templateVersion,
    renderHash: input.renderHash,
  });
  await deps.attachPngToCard({ cardId: card.id, assetId });
  return card;
}

/**
 * Foto del participante, sólo si la plantilla la usa.
 *
 * Dos condiciones, no una: que la inscripción TENGA foto y que la persona
 * haya dado su consentimiento de imagen. El consentimiento se evalúa con el
 * mismo criterio que las placas (`hasClickatonCardConsent`), no con uno
 * propio. Hacía falta acá porque el PNG del diploma se sirve públicamente
 * (para que se vea dentro del correo) y viaja adjunto: sin este chequeo, la
 * cara de alguien que nunca dio permiso terminaba publicada.
 *
 * Sin consentimiento NO se emite ese diploma —y se dice por qué—, pero no se
 * corta el lote: el resto de los acreditados sigue.
 */
async function resolveDiplomaPhoto(
  deps: ReturnType<typeof resolveDeps>,
  registration: DiplomaRegistrationSnapshot,
  usesParticipantPhoto: boolean
): Promise<
  | { ok: true; photoDataUrl: string | null }
  | { ok: false; code: DiplomaErrorCode }
> {
  if (!usesParticipantPhoto) return { ok: true, photoDataUrl: null };

  if (!registration.profilePhotoAssetId) {
    return { ok: false, code: "DIPLOMA_PHOTO_REQUIRED" };
  }
  if (!hasClickatonCardConsent(registration)) {
    return { ok: false, code: "DIPLOMA_PHOTO_CONSENT_MISSING" };
  }

  try {
    const photoDataUrl = await deps.resolvePhoto({
      profilePhotoAssetId: registration.profilePhotoAssetId,
    });
    return { ok: true, photoDataUrl };
  } catch (err) {
    throw new DiplomaServiceError("DIPLOMA_PHOTO_UNREADABLE", [
      err instanceof Error ? err.message : String(err),
    ]);
  }
}

/**
 * Deja `STALE` a las piezas de diploma anteriores de la inscripción, una vez
 * que el emisor (`ClickatonDiplomaIssue`) ya apunta a la nueva. El orden
 * importa: si se hiciera antes, habría un instante en que el emisor apunta a
 * una pieza que ya no está `READY` y el participante vería su diploma como
 * inexistente.
 *
 * Mejor esfuerzo: el diploma ya está emitido y entregable. Si esto falla,
 * lo único que queda es una pieza vieja de más, que como mucho hace que esa
 * persona aparezca dos veces en la descarga en ZIP hasta el próximo rehacer.
 */
async function markOtherDiplomaCardsStaleBestEffort(
  deps: ReturnType<typeof resolveDeps>,
  input: { registrationId: string; exceptCardId: string }
): Promise<void> {
  try {
    await deps.markOtherCardsStale(input);
  } catch (err) {
    console.error("[clickaton-diplomas] no se pudieron marcar las piezas viejas", {
      registrationId: input.registrationId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * PDF imprimible del diploma: se intenta DESPUÉS de que el PNG ya está
 * guardado y la pieza (`ClickatonParticipantCard`) y el emisor
 * (`ClickatonDiplomaIssue`) ya se persistieron. Es decir, en el momento en
 * que se llama a esto la emisión ya es un éxito.
 *
 * Por eso es "mejor esfuerzo" y traga cualquier error: el diploma en imagen
 * es lo que no puede faltar, y un problema armando o guardando el PDF (acá
 * o en `pdf-lib`, en storage, o al escribir la base) no puede convertir una
 * emisión que ya terminó bien en un `DIPLOMA_ISSUE_FAILED`. No hay reintento
 * a mitad de camino: si falla, la pieza queda con `pdfAssetId`/
 * `pdfStorageKey` en `null`, como si no se hubiese intentado, y el próximo
 * `issueDiploma` para esa inscripción (reintentar, o el flujo de "rehacer")
 * lo vuelve a probar con la misma storage key (misma `renderHash` que el
 * PNG), así que no hay riesgo de duplicar archivos.
 */
async function attachDiplomaPdfBestEffort(
  deps: ReturnType<typeof resolveDeps>,
  input: {
    cardId: string;
    editionId: string;
    registrationId: string;
    png: Buffer;
    templateKey: string;
    templateVersion: number;
    renderHash: string;
  }
): Promise<boolean> {
  try {
    const pdf = await deps.buildPdf(input.png);
    const pdfStorageKey = buildParticipantCardStorageKey({
      editionId: input.editionId,
      registrationId: input.registrationId,
      cardType: "diploma",
      templateVersion: input.templateVersion,
      renderHash: input.renderHash,
      extension: "pdf",
    });
    const saved = await deps.savePdfToStorage({
      storageKey: pdfStorageKey,
      pdf,
      templateKey: input.templateKey,
      templateVersion: input.templateVersion,
    });
    const pdfAssetId = await deps.persistPdfAsset({
      cardId: input.cardId,
      editionId: input.editionId,
      registrationId: input.registrationId,
      storageKey: saved.storageKey,
      publicUrl: saved.publicUrl,
      pdf,
    });
    await deps.attachPdfToCard({
      cardId: input.cardId,
      pdfAssetId,
      pdfStorageKey: saved.storageKey,
    });
    return true;
  } catch (err) {
    // No se propaga —ver comentario de la función—, pero sí se deja rastro:
    // el motivo en el registro del servidor y la marca `pdfAttached: false`
    // en el resultado, que es lo que permite enterarse de que el PDF falla
    // sin tener que mirar la base fila por fila.
    console.error("[clickaton-diplomas] no se pudo adjuntar el PDF", {
      cardId: input.cardId,
      registrationId: input.registrationId,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

/**
 * Emite el diploma de una inscripción acreditada.
 *
 * Orden estricto (ver comentario del módulo): autorización → acreditación →
 * plantilla → foto → render → storage → persistencia. Ante el primer
 * problema, no se llama ni a `renderPng` ni a nada posterior, y el resultado
 * siempre es `{ ok: false, code, issues }` — nunca una excepción cruda.
 *
 * El PDF (`attachDiplomaPdfBestEffort`) corre al final de cada camino de
 * éxito, después de que el PNG y la persistencia ya cerraron: nunca antes,
 * para no arriesgar la parte que no puede faltar.
 */
export async function issueDiploma(
  input: { registrationId: string; actor: ParticipantCardActor },
  depsArg: DiplomaServiceDeps = {}
): Promise<IssueDiplomaResult> {
  const deps = resolveDeps(depsArg);

  try {
    try {
      deps.checkAccess(input.actor);
    } catch (err) {
      throw new DiplomaServiceError("DIPLOMA_FORBIDDEN", [
        err instanceof Error ? err.message : String(err),
      ]);
    }

    const registration = await deps.loadRegistration(input.registrationId);
    if (!registration) {
      return { ok: false, code: "DIPLOMA_REGISTRATION_NOT_FOUND", issues: [] };
    }

    if (!isAccredited(registration.checkIns)) {
      return { ok: false, code: "DIPLOMA_NOT_ACCREDITED", issues: [] };
    }

    const template = await deps.resolveTemplate({ editionId: registration.editionId });
    if (!template.ok) {
      return { ok: false, code: template.code, issues: template.issues };
    }

    const foto = await resolveDiplomaPhoto(deps, registration, template.usesParticipantPhoto);
    if (!foto.ok) return { ok: false, code: foto.code, issues: [] };
    const photoDataUrl = foto.photoDataUrl;

    const foundExisting = await deps.findExistingIssue({ registrationId: registration.id });
    // Un diploma revocado no se reusa, aunque la consulta por defecto ya lo
    // filtre: se verifica acá explícitamente y se emite uno nuevo.
    const existing = foundExisting && foundExisting.revokedAt === null ? foundExisting : null;

    const diplomaCode =
      existing?.diplomaCode ??
      buildDiplomaCode({
        visibleCode: registration.visibleCode,
        registrationId: registration.id,
        editionId: registration.editionId,
      });
    const verificationToken = existing?.verificationToken ?? generateVerificationToken();
    // La fecha de emisión se fija una sola vez, igual que el código y el
    // token: rehacer el diseño no puede hacer que el diploma impreso diga
    // una fecha y la página de verificación diga otra.
    const issuedAt = existing?.issuedAt ?? deps.now();

    const timezone = registration.edition.timezone?.trim() || CLICKATON_DEFAULT_TIMEZONE;
    const accreditedAt = earliestAccreditedAt(registration.checkIns, issuedAt);

    const templateData = buildDiplomaTemplateData({
      registration,
      photoDataUrl,
      diplomaCode,
      verificationToken,
      accreditedAt,
      issuedAt,
      timezone,
    });

    const rendered = await deps.renderPng({ preset: template.preset, templateData });

    const renderHash = computeDiplomaRenderHash({
      registrationId: registration.id,
      diplomaCode,
      source: template.source,
    });

    const storageKey = buildParticipantCardStorageKey({
      editionId: registration.editionId,
      registrationId: registration.id,
      cardType: "diploma",
      templateVersion: template.source.versionNumber,
      renderHash,
    });

    const saved = await deps.saveToStorage({
      storageKey,
      png: rendered.png,
      width: rendered.width,
      height: rendered.height,
      templateKey: template.source.templateId,
      templateVersion: template.source.versionNumber,
    });

    const upsertCardInput: DiplomaUpsertCardInput = {
      registrationId: registration.id,
      editionId: registration.editionId,
      storageKey: saved.storageKey,
      width: rendered.width,
      height: rendered.height,
      templateKey: template.source.templateId,
      templateVersion: template.source.versionNumber,
      renderHash,
      byteSize: saved.bytes,
      contentHash: saved.contentHash,
    };

    /** La pieza del PNG, con su `DnxMediaAsset` ya dado de alta y enganchado. */
    const guardarPieza = () =>
      persistDiplomaCardWithAsset(deps, {
        upsertCardInput,
        png: rendered.png,
        width: rendered.width,
        height: rendered.height,
        publicUrl: saved.publicUrl,
        editionId: registration.editionId,
        registrationId: registration.id,
        templateKey: template.source.templateId,
        templateVersion: template.source.versionNumber,
        renderHash,
      });

    const pdfInputBase = {
      editionId: registration.editionId,
      registrationId: registration.id,
      png: rendered.png,
      templateKey: template.source.templateId,
      templateVersion: template.source.versionNumber,
      renderHash,
    };

    if (existing) {
      const card = await guardarPieza();
      await deps.updateIssue({
        id: existing.id,
        cardId: card.id,
        editionId: registration.editionId,
      });
      await markOtherDiplomaCardsStaleBestEffort(deps, {
        registrationId: registration.id,
        exceptCardId: card.id,
      });
      const pdfAttached = await attachDiplomaPdfBestEffort(deps, {
        ...pdfInputBase,
        cardId: card.id,
      });
      return {
        ok: true,
        pdfAttached,
        diplomaId: existing.id,
        diplomaCode,
        verificationToken,
        cardId: card.id,
        storageKey: saved.storageKey,
        reused: true,
      };
    }

    try {
      const card = await guardarPieza();
      const created = await deps.createIssue({
        registrationId: registration.id,
        editionId: registration.editionId,
        cardId: card.id,
        diplomaCode,
        verificationToken,
        issuedAt,
      });
      await markOtherDiplomaCardsStaleBestEffort(deps, {
        registrationId: registration.id,
        exceptCardId: card.id,
      });
      const pdfAttached = await attachDiplomaPdfBestEffort(deps, {
        ...pdfInputBase,
        cardId: card.id,
      });
      return {
        ok: true,
        pdfAttached,
        diplomaId: created.id,
        diplomaCode,
        verificationToken,
        cardId: card.id,
        storageKey: saved.storageKey,
        reused: false,
      };
    } catch (err) {
      if (!(err instanceof DiplomaUniqueViolationError)) throw err;
      // Doble clic / dos pedidos a la vez: alguien más ya lo emitió mientras
      // este proceso dibujaba. Se lee de nuevo y se devuelve el diploma que
      // ganó la carrera, en vez de romper con el error crudo de la base.
      const raced = await deps.findExistingIssue({ registrationId: registration.id });
      if (!raced || raced.revokedAt !== null) throw err;
      const cardId = raced.cardId ?? (await guardarPieza()).id;
      await markOtherDiplomaCardsStaleBestEffort(deps, {
        registrationId: registration.id,
        exceptCardId: cardId,
      });
      const pdfAttached = await attachDiplomaPdfBestEffort(deps, {
        ...pdfInputBase,
        cardId,
      });
      return {
        ok: true,
        pdfAttached,
        diplomaId: raced.id,
        diplomaCode: raced.diplomaCode,
        verificationToken: raced.verificationToken,
        cardId,
        storageKey: saved.storageKey,
        reused: true,
      };
    }
  } catch (err) {
    if (err instanceof DiplomaServiceError) {
      return { ok: false, code: err.code, issues: err.issues };
    }
    return {
      ok: false,
      code: "DIPLOMA_ISSUE_FAILED",
      issues: [err instanceof Error ? err.message : String(err)],
    };
  }
}

export type DiplomaPreviewResult =
  | { ok: true; png: Buffer; width: number; height: number }
  | { ok: false; code: DiplomaErrorCode; issues: string[] };

/**
 * Vista previa del diploma de una inscripción: el mismo camino que
 * `issueDiploma` hasta el render inclusive (autorización → acreditación →
 * plantilla → foto → render), pero nunca persiste nada — ni la pieza
 * (`ClickatonParticipantCard`) ni el emisor (`ClickatonDiplomaIssue`). No
 * llama a `saveToStorage`, `upsertCard`, `findExistingIssue`, `createIssue`
 * ni `updateIssue`.
 *
 * El código y el token de muestra son fijos y nunca se guardan: es lo que
 * permite mirar el diseño real antes de largar el lote sin gastar un código
 * de verdad ni dejar una fila fantasma en la base.
 */
export async function renderDiplomaPreview(
  input: { registrationId: string; actor: ParticipantCardActor },
  depsArg: DiplomaServiceDeps = {}
): Promise<DiplomaPreviewResult> {
  const deps = resolveDeps(depsArg);

  try {
    try {
      deps.checkAccess(input.actor);
    } catch (err) {
      throw new DiplomaServiceError("DIPLOMA_FORBIDDEN", [
        err instanceof Error ? err.message : String(err),
      ]);
    }

    const registration = await deps.loadRegistration(input.registrationId);
    if (!registration) {
      return { ok: false, code: "DIPLOMA_REGISTRATION_NOT_FOUND", issues: [] };
    }

    if (!isAccredited(registration.checkIns)) {
      return { ok: false, code: "DIPLOMA_NOT_ACCREDITED", issues: [] };
    }

    const template = await deps.resolveTemplate({ editionId: registration.editionId });
    if (!template.ok) {
      return { ok: false, code: template.code, issues: template.issues };
    }

    const foto = await resolveDiplomaPhoto(deps, registration, template.usesParticipantPhoto);
    if (!foto.ok) return { ok: false, code: foto.code, issues: [] };
    const photoDataUrl = foto.photoDataUrl;

    const timezone = registration.edition.timezone?.trim() || CLICKATON_DEFAULT_TIMEZONE;
    const now = deps.now();
    const accreditedAt = earliestAccreditedAt(registration.checkIns, now);

    const templateData = buildDiplomaTemplateData({
      registration,
      photoDataUrl,
      // Muestra: nunca se persiste, así que un código o token real acá
      // sería un desperdicio (y podría confundirse con uno de verdad si se
      // llegara a filtrar fuera de la vista previa).
      diplomaCode: "MUESTRA",
      verificationToken: "vista-previa",
      accreditedAt,
      issuedAt: now,
      timezone,
    });

    const rendered = await deps.renderPng({ preset: template.preset, templateData });
    return { ok: true, png: rendered.png, width: rendered.width, height: rendered.height };
  } catch (err) {
    if (err instanceof DiplomaServiceError) {
      return { ok: false, code: err.code, issues: err.issues };
    }
    return {
      ok: false,
      code: "DIPLOMA_ISSUE_FAILED",
      issues: [err instanceof Error ? err.message : String(err)],
    };
  }
}
