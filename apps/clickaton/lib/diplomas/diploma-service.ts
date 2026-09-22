/**
 * Emisor del diploma de participación.
 *
 * Orquesta, en orden, y corta ante el primer problema sin dibujar nada:
 * 0. Autorización del actor (sólo admin).
 * 1. Carga la inscripción (con check-ins y edición).
 * 2. Acreditación vigente (no mira el pago).
 * 3. Plantilla del diploma (Task 4) — si no resuelve, listo, no se renderiza.
 * 4. Foto del participante, sólo si la plantilla la usa.
 * 5. Código, token y fecha de emisión: si ya hay un diploma vigente para la
 *    inscripción, se reusan los tres (`reused: true`); si no, se generan
 *    (Task 5) y la fecha de emisión es la de hoy. Un diploma revocado NO
 *    cuenta como vigente: se emite uno nuevo, con código y token propios.
 * 6. Render, guardado en storage y persistencia de la pieza y del emisor.
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
  clickatonTemplateVariablesPlugin,
  createTemplateVariableRegistry,
  formatDateShort,
  fromLegacyTemplateV2,
  parseTemplateDocument,
  resolveTemplateDocument,
  type ResolvedTemplateDocument,
} from "@repo/template-engine";
import { resolveClickatonPublicOrigin } from "@/lib/site/public-origin";
import { isAccredited } from "./diploma-eligibility";
import { resolveDiplomaTemplate } from "./diploma-template";
import { buildDiplomaCode, generateVerificationToken } from "./diploma-code";
import type { DiplomaErrorCode } from "./diploma-types";
import { buildParticipantCardStorageKey } from "../participant-cards/participant-card-r2-keys";
import { resolveParticipantCardRenderProvider } from "../participant-cards/participant-card-render-provider";
import { createParticipantCardAssetStore } from "../participant-cards/participant-card-asset-store";
import { resolveParticipantPhotoDataUrl } from "../participant-cards/participant-card-photo";
import { requireParticipantCardAdminAccess } from "../participant-cards/participant-card-authorization";
import { CLICKATON_CARD_RENDERER_VERSION } from "../participant-cards/participant-card-renderer-version";
import {
  instantiatePresetPayload,
  type ClickatonCardPreset,
} from "../participant-cards/participant-card-presets";
import type { ParticipantCardActor } from "../participant-cards/participant-card-types";

export type DiplomaRegistrationSnapshot = {
  id: string;
  editionId: string;
  firstName: string;
  lastName: string;
  email: string;
  visibleCode: string | null;
  profilePhotoAssetId: string | null;
  checkIns: Array<{ checkedInAt: Date; reversedAt: Date | null }>;
  edition: { name: string; slug: string; timezone?: string | null };
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

const REGISTRATION_SELECT = {
  id: true,
  editionId: true,
  firstName: true,
  lastName: true,
  email: true,
  visibleCode: true,
  profilePhotoAssetId: true,
  checkIns: {
    where: { reversedAt: null },
    select: { checkedInAt: true, reversedAt: true },
    orderBy: { checkedInAt: "asc" },
  },
  edition: { select: { name: true, slug: true, timezone: true } },
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
  return { storageKey: stored.key, publicUrl: stored.publicUrl };
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
 * Datos que ve el render. Incluye ya las cuatro variables del diploma
 * (`diploma.code`, `diploma.issuedAtFormatted`, `diploma.accreditedAtFormatted`,
 * `diploma.verificationUrl`) aunque el catálogo del motor todavía no las declare
 * (eso es la Task 11): el shape queda listo para cuando se enchufen.
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
  const { registration } = input;
  const fullName = [registration.firstName, registration.lastName]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(" ");

  const nested: Record<string, unknown> = {
    participant: {
      id: registration.id,
      fullName,
      firstName: registration.firstName.trim(),
      lastName: registration.lastName.trim(),
      displayName: fullName.toUpperCase(),
      photo: input.photoDataUrl ?? "",
      photoUrl: input.photoDataUrl ?? "",
    },
    edition: {
      id: registration.editionId,
      name: registration.edition.name,
      slug: registration.edition.slug,
    },
    diploma: {
      code: input.diplomaCode,
      issuedAtFormatted: formatDateShort(input.issuedAt, input.timezone),
      accreditedAtFormatted: formatDateShort(input.accreditedAt, input.timezone),
      verificationUrl: buildDiplomaVerificationUrl(input.verificationToken),
    },
  };

  const flat: Record<string, unknown> = {};
  const walk = (obj: Record<string, unknown>, prefix: string) => {
    for (const [k, v] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${k}` : k;
      if (v && typeof v === "object" && !Array.isArray(v)) {
        walk(v as Record<string, unknown>, path);
      } else {
        flat[path] = v;
      }
    }
  };
  walk(nested, "");

  return { ...nested, ...flat };
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
 * Emite el diploma de una inscripción acreditada.
 *
 * Orden estricto (ver comentario del módulo): autorización → acreditación →
 * plantilla → foto → render → storage → persistencia. Ante el primer
 * problema, no se llama ni a `renderPng` ni a nada posterior, y el resultado
 * siempre es `{ ok: false, code, issues }` — nunca una excepción cruda.
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

    let photoDataUrl: string | null = null;
    if (template.usesParticipantPhoto) {
      if (!registration.profilePhotoAssetId) {
        return { ok: false, code: "DIPLOMA_PHOTO_REQUIRED", issues: [] };
      }
      try {
        photoDataUrl = await deps.resolvePhoto({
          profilePhotoAssetId: registration.profilePhotoAssetId,
        });
      } catch (err) {
        throw new DiplomaServiceError("DIPLOMA_PHOTO_UNREADABLE", [
          err instanceof Error ? err.message : String(err),
        ]);
      }
    }

    const foundExisting = await deps.findExistingIssue({ registrationId: registration.id });
    // Un diploma revocado no se reusa, aunque la consulta por defecto ya lo
    // filtre: se verifica acá explícitamente y se emite uno nuevo.
    const existing = foundExisting && foundExisting.revokedAt === null ? foundExisting : null;

    const diplomaCode =
      existing?.diplomaCode ??
      buildDiplomaCode({
        visibleCode: registration.visibleCode,
        registrationId: registration.id,
        editionSlug: registration.edition.slug,
      });
    const verificationToken = existing?.verificationToken ?? generateVerificationToken();
    // La fecha de emisión se fija una sola vez, igual que el código y el
    // token: rehacer el diseño no puede hacer que el diploma impreso diga
    // una fecha y la página de verificación diga otra.
    const issuedAt = existing?.issuedAt ?? deps.now();

    const timezone = registration.edition.timezone?.trim() || "America/Argentina/Cordoba";
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
    };

    if (existing) {
      const card = await deps.upsertCard(upsertCardInput);
      await deps.updateIssue({
        id: existing.id,
        cardId: card.id,
        editionId: registration.editionId,
      });
      return {
        ok: true,
        diplomaId: existing.id,
        diplomaCode,
        verificationToken,
        cardId: card.id,
        storageKey: saved.storageKey,
        reused: true,
      };
    }

    try {
      const card = await deps.upsertCard(upsertCardInput);
      const created = await deps.createIssue({
        registrationId: registration.id,
        editionId: registration.editionId,
        cardId: card.id,
        diplomaCode,
        verificationToken,
        issuedAt,
      });
      return {
        ok: true,
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
      const cardId = raced.cardId ?? (await deps.upsertCard(upsertCardInput)).id;
      return {
        ok: true,
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

    let photoDataUrl: string | null = null;
    if (template.usesParticipantPhoto) {
      if (!registration.profilePhotoAssetId) {
        return { ok: false, code: "DIPLOMA_PHOTO_REQUIRED", issues: [] };
      }
      try {
        photoDataUrl = await deps.resolvePhoto({
          profilePhotoAssetId: registration.profilePhotoAssetId,
        });
      } catch (err) {
        throw new DiplomaServiceError("DIPLOMA_PHOTO_UNREADABLE", [
          err instanceof Error ? err.message : String(err),
        ]);
      }
    }

    const timezone = registration.edition.timezone?.trim() || "America/Argentina/Cordoba";
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
