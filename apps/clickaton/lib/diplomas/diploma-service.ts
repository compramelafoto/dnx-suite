/**
 * Emisor del diploma de participación.
 *
 * Orquesta, en orden, y corta ante el primer problema sin dibujar nada:
 * 1. Carga la inscripción (con check-ins y edición).
 * 2. Acreditación vigente (no mira el pago).
 * 3. Plantilla del diploma (Task 4) — si no resuelve, listo, no se renderiza.
 * 4. Foto del participante, sólo si la plantilla la usa.
 * 5. Código y token: si ya hay un diploma vigente para la inscripción, se
 *    reusan (`reused: true`); si no, se generan (Task 5).
 * 6. Render, guardado en storage y persistencia de la pieza y del emisor.
 *
 * No reutiliza `generateClickatonParticipantCard` / `getOrGenerateClickatonParticipantCard`:
 * el diploma resuelve su propia plantilla (sin preset de respaldo) y no tiene el
 * cache-por-render-hash ni el locking de las placas welcome/member. Mezclarlo
 * hubiera significado tocar ese pipeline (que hoy funciona en producción) para
 * algo que el diploma no necesita.
 */
import { createHash } from "node:crypto";
import { prisma } from "@/lib/admin/db";
import { formatDateShort } from "@repo/template-engine";
import { resolveClickatonPublicOrigin } from "@/lib/site/public-origin";
import { isAccredited } from "./diploma-eligibility";
import { resolveDiplomaTemplate } from "./diploma-template";
import { buildDiplomaCode, generateVerificationToken } from "./diploma-code";
import type { DiplomaErrorCode } from "./diploma-types";
import { buildParticipantCardStorageKey } from "../participant-cards/participant-card-r2-keys";
import { resolveClickatonParticipantCardDocument } from "../participant-cards/participant-card-renderer";
import { resolveParticipantCardRenderProvider } from "../participant-cards/participant-card-render-provider";
import { createParticipantCardAssetStore } from "../participant-cards/participant-card-asset-store";
import { resolveParticipantPhotoDataUrl } from "../participant-cards/participant-card-photo";
import { CLICKATON_CARD_RENDERER_VERSION } from "../participant-cards/participant-card-renderer-version";
import type { ClickatonCardPreset } from "../participant-cards/participant-card-presets";
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

export type DiplomaServiceDeps = {
  loadRegistration?: (
    registrationId: string
  ) => Promise<DiplomaRegistrationSnapshot | null>;
  resolveTemplate?: (input: {
    editionId: string;
  }) => Promise<DiplomaTemplateResolution>;
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

async function defaultRenderPng(
  input: DiplomaRenderPngInput
): Promise<DiplomaRenderPngResult> {
  const preset = input.preset as ClickatonCardPreset;
  const { document } = resolveClickatonParticipantCardDocument({
    cardType: "diploma",
    templateData: input.templateData,
    preset,
  });
  const provider = resolveParticipantCardRenderProvider();
  return provider.render({ document });
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
  const existing = await prisma.clickatonParticipantCard.findFirst({
    where: {
      registrationId: input.registrationId,
      cardType: "DIPLOMA",
      renderHash: input.renderHash,
    },
    select: { id: true },
  });

  if (existing) {
    await prisma.clickatonParticipantCard.update({
      where: { id: existing.id },
      data: {
        status: "READY",
        storageKey: input.storageKey,
        width: input.width,
        height: input.height,
        generatedAt: now,
        updatedAt: now,
      },
    });
    return { id: existing.id };
  }

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
}

async function defaultFindExistingIssue(input: {
  registrationId: string;
}): Promise<DiplomaIssueExisting | null> {
  const row = await prisma.clickatonDiplomaIssue.findFirst({
    where: { registrationId: input.registrationId, revokedAt: null },
    select: { id: true, diplomaCode: true, verificationToken: true, revokedAt: true },
  });
  return row ?? null;
}

async function defaultCreateIssue(
  data: DiplomaCreateIssueInput
): Promise<DiplomaIssueWriteResult> {
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
    loadRegistration: deps.loadRegistration ?? defaultLoadRegistration,
    resolveTemplate: deps.resolveTemplate ?? resolveDiplomaTemplate,
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
      id: registration.edition.slug,
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
  });
  return createHash("sha256").update(payload).digest("hex");
}

/**
 * Emite el diploma de una inscripción acreditada.
 *
 * Orden estricto (ver comentario del módulo): acreditación → plantilla → foto
 * → render → storage → persistencia. Ante el primer `ok: false`, no se llama
 * ni a `renderPng` ni a nada posterior.
 */
export async function issueDiploma(
  input: { registrationId: string; actor: ParticipantCardActor },
  depsArg: DiplomaServiceDeps = {}
): Promise<IssueDiplomaResult> {
  const deps = resolveDeps(depsArg);

  const registration = await deps.loadRegistration(input.registrationId);
  if (!registration) {
    throw new Error(`DIPLOMA_REGISTRATION_NOT_FOUND: ${input.registrationId}`);
  }

  if (!isAccredited(registration.checkIns)) {
    return { ok: false, code: "DIPLOMA_NOT_ACCREDITED", issues: [] };
  }

  const template = await deps.resolveTemplate({ editionId: registration.editionId });
  if (!template.ok) {
    return { ok: false, code: template.code, issues: template.issues };
  }

  if (template.usesParticipantPhoto && !registration.profilePhotoAssetId) {
    return { ok: false, code: "DIPLOMA_PHOTO_REQUIRED", issues: [] };
  }

  const existing = await deps.findExistingIssue({ registrationId: registration.id });

  const diplomaCode =
    existing?.diplomaCode ??
    buildDiplomaCode({
      visibleCode: registration.visibleCode,
      registrationId: registration.id,
      editionSlug: registration.edition.slug,
    });
  const verificationToken = existing?.verificationToken ?? generateVerificationToken();

  const issuedAt = deps.now();
  const timezone = registration.edition.timezone?.trim() || "America/Argentina/Cordoba";
  const accreditedAt = earliestAccreditedAt(registration.checkIns, issuedAt);

  const photoDataUrl = template.usesParticipantPhoto
    ? await resolveParticipantPhotoDataUrl(registration.profilePhotoAssetId)
    : null;

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

  const card = await deps.upsertCard({
    registrationId: registration.id,
    editionId: registration.editionId,
    storageKey: saved.storageKey,
    width: rendered.width,
    height: rendered.height,
    templateKey: template.source.templateId,
    templateVersion: template.source.versionNumber,
    renderHash,
  });

  if (existing) {
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
}
