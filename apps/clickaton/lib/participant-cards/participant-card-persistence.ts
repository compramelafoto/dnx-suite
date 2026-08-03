import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@repo/db";
import { prisma as defaultPrisma } from "@/lib/admin/db";
import { recordParticipantCardAudit } from "./participant-card-audit";
import {
  recordParticipantCardCacheHit,
  recordParticipantCardCacheMiss,
  recordParticipantCardRenderDuration,
  recordParticipantCardStatus,
  recordParticipantCardStoragePut,
} from "./participant-card-metrics";
import {
  createParticipantCardAssetStore,
  loadParticipantCardPngFromAsset,
  persistParticipantCardMediaAsset,
  type ParticipantCardAssetStore,
} from "./participant-card-asset-store";
import {
  computeClickatonParticipantCardRenderHash,
  renderHashPrefix,
} from "./participant-card-hash";
import { buildParticipantCardStorageKey } from "./participant-card-r2-keys";
import {
  resolveParticipantCardRenderProvider,
  type ParticipantCardRenderProvider,
} from "./participant-card-render-provider";
import { resolveClickatonParticipantCardDocument } from "./participant-card-renderer";
import { CLICKATON_CARD_RENDERER_VERSION } from "./participant-card-renderer-version";
import {
  buildClickatonParticipantTemplateData,
  buildParticipantCardFilename,
} from "./participant-card-data";
import { requireParticipantCardReadAccess } from "./participant-card-authorization";
import { hasClickatonCardConsent } from "./participant-card-consent";
import { evaluateClickatonCardEligibility } from "./participant-card-eligibility";
import {
  cardNotFound,
  cardPhotoRequired,
  cardConsentRequired,
  cardNotEligible,
  cardRateLimited,
  ClickatonCardError,
} from "./participant-card-errors";
import { checkParticipantCardRateLimit } from "./participant-card-rate-limit";
import {
  getClickatonParticipantCardPreset,
  normalizeParticipantCardType,
} from "./participant-card-presets";
import { resolveParticipantPhotoDataUrl } from "./participant-card-photo";
import { CLICKATON_FIXTURE_PHOTO_DATA_URL } from "@repo/template-engine";
import type {
  ClickatonParticipantCardType,
  GenerateClickatonParticipantCardInput,
  GenerateClickatonParticipantCardResult,
  ParticipantCardActor,
  ParticipantCardEligibility,
  ParticipantCardMode,
  ParticipantCardRegistrationSnapshot,
  ParticipantCardSourceSummary,
} from "./participant-card-types";

const LOCK_TTL_MS = 120_000;
const POLL_INTERVAL_MS = 200;
const POLL_MAX_MS = 8_000;

export type ParticipantCardDbStatus =
  | "NOT_GENERATED"
  | "GENERATING"
  | "READY"
  | "FAILED"
  | "STALE";

export type ParticipantCardCacheStatus = "HIT" | "MISS" | "REGENERATED";

export type ParticipantCardRecord = {
  id: string;
  registrationId: string;
  editionId: string;
  cardType: "WELCOME" | "MEMBER";
  templateKey: string;
  templateVersion: number;
  rendererVersion: string;
  renderHash: string;
  status: "GENERATING" | "READY" | "FAILED" | "STALE" | "DELETED";
  assetId: string | null;
  storageKey: string | null;
  width: number | null;
  height: number | null;
  mimeType: string;
  byteSize: number | null;
  contentHash: string | null;
  startedAt: Date;
  generatedAt: Date | null;
  failedAt: Date | null;
  generatedByUserId: number | null;
  sourceUpdatedAt: Date | null;
  attemptCount: number;
  errorCode: string | null;
  lockExpiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export class ParticipantCardUniqueViolationError extends Error {
  readonly code = "P2002" as const;
  constructor() {
    super("Unique constraint violation");
    this.name = "ParticipantCardUniqueViolationError";
  }
}

export interface ParticipantCardRepository {
  findByRegistrationCardTypeHash(input: {
    registrationId: string;
    cardType: "WELCOME" | "MEMBER";
    renderHash: string;
  }): Promise<ParticipantCardRecord | null>;
  findReadyByHash(input: {
    registrationId: string;
    cardType: "WELCOME" | "MEMBER";
    renderHash: string;
  }): Promise<ParticipantCardRecord | null>;
  findLatestForRegistrationCardType(input: {
    registrationId: string;
    cardType: "WELCOME" | "MEMBER";
  }): Promise<ParticipantCardRecord | null>;
  listByRegistrationCardType(input: {
    registrationId: string;
    cardType: "WELCOME" | "MEMBER";
  }): Promise<ParticipantCardRecord[]>;
  createGenerating(input: Omit<
    ParticipantCardRecord,
    "generatedAt" | "failedAt" | "assetId" | "storageKey" | "width" | "height" | "byteSize" | "contentHash" | "errorCode"
  >): Promise<ParticipantCardRecord>;
  updateRecord(
    id: string,
    data: Partial<ParticipantCardRecord>
  ): Promise<ParticipantCardRecord>;
  markOtherReadyAsStale(input: {
    registrationId: string;
    cardType: "WELCOME" | "MEMBER";
    exceptId: string;
    now: Date;
  }): Promise<number>;
  markAllReadyAsStale(input: {
    registrationId: string;
    cardType: "WELCOME" | "MEMBER";
    now: Date;
  }): Promise<number>;
  listForCleanup(): Promise<ParticipantCardRecord[]>;
  deleteRecord(id: string): Promise<void>;
}

function toDbCardType(cardType: ClickatonParticipantCardType): "WELCOME" | "MEMBER" {
  return cardType === "member" ? "MEMBER" : "WELCOME";
}

function cloneRecord(r: ParticipantCardRecord): ParticipantCardRecord {
  return { ...r };
}

export class InMemoryParticipantCardRepository implements ParticipantCardRepository {
  private records = new Map<string, ParticipantCardRecord>();
  private uniqueIndex = new Map<string, string>();

  reset(): void {
    this.records.clear();
    this.uniqueIndex.clear();
  }

  private uniqueKey(input: {
    registrationId: string;
    cardType: "WELCOME" | "MEMBER";
    renderHash: string;
  }): string {
    return `${input.registrationId}:${input.cardType}:${input.renderHash}`;
  }

  async findByRegistrationCardTypeHash(input: {
    registrationId: string;
    cardType: "WELCOME" | "MEMBER";
    renderHash: string;
  }): Promise<ParticipantCardRecord | null> {
    const id = this.uniqueIndex.get(this.uniqueKey(input));
    if (!id) return null;
    const r = this.records.get(id);
    if (!r || r.status === "DELETED") return null;
    return cloneRecord(r);
  }

  async findReadyByHash(input: {
    registrationId: string;
    cardType: "WELCOME" | "MEMBER";
    renderHash: string;
  }): Promise<ParticipantCardRecord | null> {
    const row = await this.findByRegistrationCardTypeHash(input);
    return row?.status === "READY" ? row : null;
  }

  async findLatestForRegistrationCardType(input: {
    registrationId: string;
    cardType: "WELCOME" | "MEMBER";
  }): Promise<ParticipantCardRecord | null> {
    const rows = [...this.records.values()]
      .filter(
        (r) =>
          r.registrationId === input.registrationId &&
          r.cardType === input.cardType &&
          r.status !== "DELETED"
      )
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    return rows[0] ? cloneRecord(rows[0]) : null;
  }

  async listByRegistrationCardType(input: {
    registrationId: string;
    cardType: "WELCOME" | "MEMBER";
  }): Promise<ParticipantCardRecord[]> {
    return [...this.records.values()]
      .filter(
        (r) =>
          r.registrationId === input.registrationId &&
          r.cardType === input.cardType &&
          r.status !== "DELETED"
      )
      .map(cloneRecord);
  }

  async createGenerating(
    input: Omit<
      ParticipantCardRecord,
      | "generatedAt"
      | "failedAt"
      | "assetId"
      | "storageKey"
      | "width"
      | "height"
      | "byteSize"
      | "contentHash"
      | "errorCode"
    >
  ): Promise<ParticipantCardRecord> {
    const uKey = this.uniqueKey({
      registrationId: input.registrationId,
      cardType: input.cardType,
      renderHash: input.renderHash,
    });
    const existingId = this.uniqueIndex.get(uKey);
    if (existingId) {
      const existing = this.records.get(existingId);
      if (existing && existing.status !== "DELETED") {
        throw new ParticipantCardUniqueViolationError();
      }
    }
    const record: ParticipantCardRecord = {
      ...input,
      assetId: null,
      storageKey: null,
      width: null,
      height: null,
      byteSize: null,
      contentHash: null,
      generatedAt: null,
      failedAt: null,
      errorCode: null,
    };
    this.records.set(record.id, record);
    this.uniqueIndex.set(uKey, record.id);
    return cloneRecord(record);
  }

  async updateRecord(
    id: string,
    data: Partial<ParticipantCardRecord>
  ): Promise<ParticipantCardRecord> {
    const current = this.records.get(id);
    if (!current) throw new Error("PARTICIPANT_CARD_NOT_FOUND");
    const next = { ...current, ...data, updatedAt: data.updatedAt ?? new Date() };
    this.records.set(id, next);
    return cloneRecord(next);
  }

  async markOtherReadyAsStale(input: {
    registrationId: string;
    cardType: "WELCOME" | "MEMBER";
    exceptId: string;
    now: Date;
  }): Promise<number> {
    let count = 0;
    for (const r of this.records.values()) {
      if (
        r.registrationId === input.registrationId &&
        r.cardType === input.cardType &&
        r.status === "READY" &&
        r.id !== input.exceptId
      ) {
        r.status = "STALE";
        r.updatedAt = input.now;
        count++;
      }
    }
    return count;
  }

  async markAllReadyAsStale(input: {
    registrationId: string;
    cardType: "WELCOME" | "MEMBER";
    now: Date;
  }): Promise<number> {
    let count = 0;
    for (const r of this.records.values()) {
      if (
        r.registrationId === input.registrationId &&
        r.cardType === input.cardType &&
        r.status === "READY"
      ) {
        r.status = "STALE";
        r.updatedAt = input.now;
        count++;
      }
    }
    return count;
  }

  async listForCleanup(): Promise<ParticipantCardRecord[]> {
    return [...this.records.values()].map(cloneRecord);
  }

  async deleteRecord(id: string): Promise<void> {
    const row = this.records.get(id);
    if (row) {
      this.uniqueIndex.delete(
        this.uniqueKey({
          registrationId: row.registrationId,
          cardType: row.cardType,
          renderHash: row.renderHash,
        })
      );
    }
    this.records.delete(id);
  }
}

function mapPrismaRecord(row: {
  id: string;
  registrationId: string;
  editionId: string;
  cardType: "WELCOME" | "MEMBER";
  templateKey: string;
  templateVersion: number;
  rendererVersion: string;
  renderHash: string;
  status: "GENERATING" | "READY" | "FAILED" | "STALE" | "DELETED";
  assetId: string | null;
  storageKey: string | null;
  width: number | null;
  height: number | null;
  mimeType: string;
  byteSize: number | null;
  contentHash: string | null;
  startedAt: Date;
  generatedAt: Date | null;
  failedAt: Date | null;
  generatedByUserId: number | null;
  sourceUpdatedAt: Date | null;
  attemptCount: number;
  errorCode: string | null;
  lockExpiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): ParticipantCardRecord {
  return { ...row };
}

export function createPrismaParticipantCardRepository(
  prisma: PrismaClient
): ParticipantCardRepository {
  return {
    async findByRegistrationCardTypeHash(input) {
      const row = await prisma.clickatonParticipantCard.findUnique({
        where: {
          registrationId_cardType_renderHash: {
            registrationId: input.registrationId,
            cardType: input.cardType,
            renderHash: input.renderHash,
          },
        },
      });
      return row ? mapPrismaRecord(row) : null;
    },
    async findReadyByHash(input) {
      const row = await this.findByRegistrationCardTypeHash(input);
      return row?.status === "READY" ? row : null;
    },
    async findLatestForRegistrationCardType(input) {
      const row = await prisma.clickatonParticipantCard.findFirst({
        where: {
          registrationId: input.registrationId,
          cardType: input.cardType,
          status: { not: "DELETED" },
        },
        orderBy: { updatedAt: "desc" },
      });
      return row ? mapPrismaRecord(row) : null;
    },
    async listByRegistrationCardType(input) {
      const rows = await prisma.clickatonParticipantCard.findMany({
        where: {
          registrationId: input.registrationId,
          cardType: input.cardType,
          status: { not: "DELETED" },
        },
      });
      return rows.map(mapPrismaRecord);
    },
    async createGenerating(input) {
      try {
        const row = await prisma.clickatonParticipantCard.create({
          data: {
            id: input.id,
            registrationId: input.registrationId,
            editionId: input.editionId,
            cardType: input.cardType,
            templateKey: input.templateKey,
            templateVersion: input.templateVersion,
            rendererVersion: input.rendererVersion,
            renderHash: input.renderHash,
            status: "GENERATING",
            mimeType: input.mimeType,
            startedAt: input.startedAt,
            generatedByUserId: input.generatedByUserId,
            sourceUpdatedAt: input.sourceUpdatedAt,
            attemptCount: input.attemptCount,
            lockExpiresAt: input.lockExpiresAt,
            createdAt: input.createdAt,
            updatedAt: input.updatedAt,
          },
        });
        return mapPrismaRecord(row);
      } catch (err) {
        if (
          err &&
          typeof err === "object" &&
          "code" in err &&
          (err as { code: string }).code === "P2002"
        ) {
          throw new ParticipantCardUniqueViolationError();
        }
        throw err;
      }
    },
    async updateRecord(id, data) {
      const row = await prisma.clickatonParticipantCard.update({
        where: { id },
        data: {
          status: data.status,
          assetId: data.assetId,
          storageKey: data.storageKey,
          width: data.width,
          height: data.height,
          byteSize: data.byteSize,
          contentHash: data.contentHash,
          generatedAt: data.generatedAt,
          failedAt: data.failedAt,
          errorCode: data.errorCode,
          lockExpiresAt: data.lockExpiresAt,
          attemptCount: data.attemptCount,
          updatedAt: data.updatedAt ?? new Date(),
        },
      });
      return mapPrismaRecord(row);
    },
    async markOtherReadyAsStale(input) {
      const result = await prisma.clickatonParticipantCard.updateMany({
        where: {
          registrationId: input.registrationId,
          cardType: input.cardType,
          status: "READY",
          id: { not: input.exceptId },
        },
        data: { status: "STALE", updatedAt: input.now },
      });
      return result.count;
    },
    async markAllReadyAsStale(input) {
      const result = await prisma.clickatonParticipantCard.updateMany({
        where: {
          registrationId: input.registrationId,
          cardType: input.cardType,
          status: "READY",
        },
        data: { status: "STALE", updatedAt: input.now },
      });
      return result.count;
    },
    async listForCleanup() {
      const rows = await prisma.clickatonParticipantCard.findMany({
        where: { status: { in: ["READY", "STALE", "FAILED"] } },
      });
      return rows.map(mapPrismaRecord);
    },
    async deleteRecord(id) {
      await prisma.clickatonParticipantCard.delete({ where: { id } });
    },
  };
}

export type ParticipantCardPersistenceDeps = {
  repository?: ParticipantCardRepository;
  prisma?: PrismaClient;
  store?: ParticipantCardAssetStore;
  renderProvider?: ParticipantCardRenderProvider;
  now?: () => Date;
  loadRegistration?: (
    registrationId: string
  ) => Promise<(ParticipantCardRegistrationSnapshot & { editionId: string }) | null>;
  loadPhotoContentHash?: (photoAssetId: string | null) => Promise<string | null>;
  persistAsset?: typeof persistParticipantCardMediaAsset;
};

const REGISTRATION_SELECT = {
  id: true,
  editionId: true,
  userId: true,
  email: true,
  firstName: true,
  lastName: true,
  city: true,
  province: true,
  country: true,
  instagramHandle: true,
  instagramHandleNormalized: true,
  profilePhotoAssetId: true,
  profilePhotoStatus: true,
  visibleCode: true,
  sequenceNumber: true,
  status: true,
  paymentStatus: true,
  imageUsageConsent: true,
  socialPublicationConsent: true,
  consentAcceptedAt: true,
  acceptedImageAt: true,
  acceptedTermsAt: true,
  termsAcceptedAt: true,
  termsVersion: true,
  ticketType: { select: { name: true } },
  edition: {
    select: {
      name: true,
      slug: true,
      city: true,
      startAt: true,
      location: true,
      timezone: true,
      coverImageUrl: true,
    },
  },
  venue: { select: { name: true, city: true } },
} as const;

async function defaultLoadRegistration(registrationId: string) {
  return defaultPrisma.clickatonRegistration.findUnique({
    where: { id: registrationId },
    select: REGISTRATION_SELECT,
  });
}

export async function loadParticipantCardRegistration(registrationId: string) {
  return defaultLoadRegistration(registrationId);
}

async function defaultLoadPhotoContentHash(
  photoAssetId: string | null
): Promise<string | null> {
  if (!photoAssetId) return null;
  const asset = await defaultPrisma.dnxMediaAsset.findUnique({
    where: { id: photoAssetId },
    select: { contentHash: true },
  });
  return asset?.contentHash ?? null;
}

function resolveDeps(deps?: ParticipantCardPersistenceDeps) {
  const prisma = deps?.prisma ?? defaultPrisma;
  return {
    repository:
      deps?.repository ?? createPrismaParticipantCardRepository(prisma),
    store: deps?.store ?? createParticipantCardAssetStore(),
    renderProvider:
      deps?.renderProvider ?? resolveParticipantCardRenderProvider(),
    now: deps?.now ?? (() => new Date()),
    loadRegistration: deps?.loadRegistration ?? defaultLoadRegistration,
    loadPhotoContentHash:
      deps?.loadPhotoContentHash ?? defaultLoadPhotoContentHash,
    persistAsset: deps?.persistAsset ?? persistParticipantCardMediaAsset,
    prisma,
  };
}

function resolveMode(
  actorKind: "participant" | "admin",
  mode?: ParticipantCardMode
): ParticipantCardMode {
  if (mode) return mode;
  return actorKind === "admin" ? "preview" : "final";
}

export type GetOrGenerateClickatonParticipantCardInput =
  GenerateClickatonParticipantCardInput & {
    forceGenerationId?: string;
    skipPersist?: boolean;
  };

export type GetOrGenerateClickatonParticipantCardResult =
  GenerateClickatonParticipantCardResult & {
    cacheStatus: ParticipantCardCacheStatus;
    renderHash: string;
    renderHashPrefix: string;
    recordId?: string;
    recordStatus?: ParticipantCardDbStatus;
    generatedAt?: Date | null;
  };

async function loadPngForRecord(
  record: ParticipantCardRecord,
  store: ParticipantCardAssetStore
): Promise<Buffer> {
  if (record.storageKey) {
    try {
      return await store.get(record.storageKey);
    } catch {
      /* fallback asset */
    }
  }
  if (record.assetId) {
    return loadParticipantCardPngFromAsset(record.assetId);
  }
  throw new Error("PARTICIPANT_CARD_BYTES_MISSING");
}

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

async function waitForReadyOrGenerating(input: {
  repository: ParticipantCardRepository;
  registrationId: string;
  cardType: "WELCOME" | "MEMBER";
  renderHash: string;
  now: () => Date;
}): Promise<ParticipantCardRecord | null> {
  const deadline = Date.now() + POLL_MAX_MS;
  while (Date.now() < deadline) {
    const row = await input.repository.findByRegistrationCardTypeHash({
      registrationId: input.registrationId,
      cardType: input.cardType,
      renderHash: input.renderHash,
    });
    if (row?.status === "READY") return row;
    if (
      row?.status === "GENERATING" &&
      row.lockExpiresAt &&
      row.lockExpiresAt.getTime() > input.now().getTime()
    ) {
      await sleep(POLL_INTERVAL_MS);
      continue;
    }
    if (row?.status === "FAILED") return null;
    return row;
  }
  return null;
}

async function prepareGenerationContext(
  input: GetOrGenerateClickatonParticipantCardInput,
  deps: ReturnType<typeof resolveDeps>
): Promise<{
  registration: ParticipantCardRegistrationSnapshot & { editionId: string };
  cardType: ClickatonParticipantCardType;
  mode: ParticipantCardMode;
  eligibility: ParticipantCardEligibility;
  templateData: Record<string, unknown>;
  preset: ReturnType<typeof getClickatonParticipantCardPreset>;
  renderHash: string;
  dbCardType: "WELCOME" | "MEMBER";
  photoContentHash: string | null;
  photoAssetId: string | null;
}> {
  const cardType = normalizeParticipantCardType(input.cardType);
  const mode = resolveMode(input.actor.kind, input.mode);
  const registration = await deps.loadRegistration(input.registrationId);
  if (!registration) throw cardNotFound();

  requireParticipantCardReadAccess(registration, input.actor);

  const hasConsent = hasClickatonCardConsent(registration);
  const photoDataUrl = await resolveParticipantPhotoDataUrl(
    registration.profilePhotoAssetId
  );
  const hasPhoto = Boolean(photoDataUrl);

  const eligibility = evaluateClickatonCardEligibility({
    registration,
    cardType,
    mode,
    actorKind: input.actor.kind,
    allowAdminPreview: input.actor.kind === "admin" && mode === "preview",
    hasConsent,
    hasPhoto,
  });

  if (eligibility.blocked) {
    if (eligibility.blockReason?.includes("Consentimiento")) {
      throw cardConsentRequired(eligibility.blockReason);
    }
    if (eligibility.blockReason?.includes("Foto")) {
      throw cardPhotoRequired(eligibility.blockReason);
    }
    throw cardNotEligible(eligibility.blockReason ?? "Inscripción no elegible");
  }

  const effectivePhoto =
    photoDataUrl ??
    (mode === "preview" || input.actor.kind === "admin"
      ? CLICKATON_FIXTURE_PHOTO_DATA_URL
      : null);

  if (!effectivePhoto && mode === "final") {
    throw cardPhotoRequired();
  }

  const templateData = buildClickatonParticipantTemplateData({
    registration,
    photoDataUrl: effectivePhoto ?? CLICKATON_FIXTURE_PHOTO_DATA_URL,
  });

  const preset = structuredClone(getClickatonParticipantCardPreset(cardType));
  const photoContentHash = await deps.loadPhotoContentHash(
    registration.profilePhotoAssetId
  );

  const renderHash = computeClickatonParticipantCardRenderHash({
    cardType,
    preset,
    registration,
    templateData,
    photoAssetId: registration.profilePhotoAssetId,
    photoContentHash,
    forceGenerationId: input.forceGenerationId,
  });

  return {
    registration,
    cardType,
    mode,
    eligibility,
    templateData,
    preset,
    renderHash,
    dbCardType: toDbCardType(cardType),
    photoContentHash,
    photoAssetId: registration.profilePhotoAssetId,
  };
}

export async function getOrGenerateClickatonParticipantCard(
  input: GetOrGenerateClickatonParticipantCardInput,
  depsArg?: ParticipantCardPersistenceDeps
): Promise<GetOrGenerateClickatonParticipantCardResult> {
  const deps = resolveDeps(depsArg);
  const startedAt = deps.now().getTime();
  const ctx = await prepareGenerationContext(input, deps);

  const ready = await deps.repository.findReadyByHash({
    registrationId: ctx.registration.id,
    cardType: ctx.dbCardType,
    renderHash: ctx.renderHash,
  });

  if (ready) {
    const png = await loadPngForRecord(ready, deps.store);
    recordParticipantCardCacheHit();
    recordParticipantCardStatus("READY");
    recordParticipantCardAudit("CLICKATON_CARD_REUSED", {
      registrationId: ctx.registration.id,
      editionId: ctx.registration.editionId,
      cardType: ctx.cardType,
      renderHashPrefix: renderHashPrefix(ctx.renderHash),
      cacheStatus: "HIT",
      actorKind: input.actor.kind,
      recordId: ready.id,
    });
    return buildResult({
      png,
      ctx,
      registration: ctx.registration,
      actor: input.actor,
      cacheStatus: "HIT",
      renderHash: ctx.renderHash,
      durationMs: deps.now().getTime() - startedAt,
      record: ready,
      sourceSummary: {
        presetId: ctx.preset.presetId,
        templateKey: ctx.preset.meta.templateKey,
        templateVersion: ctx.preset.meta.templateVersion,
        blockCount: ctx.preset.payload.blocks.length,
        imageCount: ctx.preset.payload.blocks.filter((b) => b.type === "PHOTO")
          .length,
      },
    });
  }

  let existing = await deps.repository.findByRegistrationCardTypeHash({
    registrationId: ctx.registration.id,
    cardType: ctx.dbCardType,
    renderHash: ctx.renderHash,
  });

  if (
    existing?.status === "GENERATING" &&
    existing.lockExpiresAt &&
    existing.lockExpiresAt.getTime() > deps.now().getTime()
  ) {
    const waited = await waitForReadyOrGenerating({
      repository: deps.repository,
      registrationId: ctx.registration.id,
      cardType: ctx.dbCardType,
      renderHash: ctx.renderHash,
      now: deps.now,
    });
    if (waited?.status === "READY") {
      const png = await loadPngForRecord(waited, deps.store);
      return buildResult({
        png,
        ctx,
        registration: ctx.registration,
        actor: input.actor,
        cacheStatus: "HIT",
        renderHash: ctx.renderHash,
        durationMs: deps.now().getTime() - startedAt,
        record: waited,
        sourceSummary: summaryFromPreset(ctx.preset),
      });
    }

    const stillGenerating =
      waited ??
      (await deps.repository.findByRegistrationCardTypeHash({
        registrationId: ctx.registration.id,
        cardType: ctx.dbCardType,
        renderHash: ctx.renderHash,
      }));
    if (
      stillGenerating?.status === "GENERATING" &&
      stillGenerating.lockExpiresAt &&
      stillGenerating.lockExpiresAt.getTime() > deps.now().getTime()
    ) {
      return buildResult({
        png: Buffer.alloc(0),
        ctx,
        registration: ctx.registration,
        actor: input.actor,
        cacheStatus: "MISS",
        renderHash: ctx.renderHash,
        durationMs: deps.now().getTime() - startedAt,
        record: stillGenerating,
        sourceSummary: summaryFromPreset(ctx.preset),
      });
    }
  }

  if (
    existing?.status === "GENERATING" &&
    (!existing.lockExpiresAt ||
      existing.lockExpiresAt.getTime() <= deps.now().getTime())
  ) {
    existing = await deps.repository.updateRecord(existing.id, {
      lockExpiresAt: new Date(deps.now().getTime() + LOCK_TTL_MS),
      attemptCount: existing.attemptCount + 1,
      updatedAt: deps.now(),
    });
  }

  let record = existing;
  const cacheStatus: ParticipantCardCacheStatus = input.forceGenerationId
    ? "REGENERATED"
    : "MISS";

  if (!record || record.status === "STALE" || record.status === "FAILED") {
    const now = deps.now();
    const id = record?.id ?? randomUUID();
    try {
      if (record && (record.status === "STALE" || record.status === "FAILED")) {
        record = await deps.repository.updateRecord(record.id, {
          status: "GENERATING",
          lockExpiresAt: new Date(now.getTime() + LOCK_TTL_MS),
          attemptCount: record.attemptCount + 1,
          errorCode: null,
          failedAt: null,
          updatedAt: now,
        });
      } else {
        record = await deps.repository.createGenerating({
          id,
          registrationId: ctx.registration.id,
          editionId: ctx.registration.editionId,
          cardType: ctx.dbCardType,
          templateKey: ctx.preset.meta.templateKey,
          templateVersion: ctx.preset.meta.templateVersion,
          rendererVersion: CLICKATON_CARD_RENDERER_VERSION,
          renderHash: ctx.renderHash,
          status: "GENERATING",
          mimeType: "image/png",
          startedAt: now,
          generatedByUserId: input.actor.userId ?? null,
          sourceUpdatedAt: now,
          attemptCount: 1,
          lockExpiresAt: new Date(now.getTime() + LOCK_TTL_MS),
          createdAt: now,
          updatedAt: now,
        });
      }
    } catch (err) {
      if (err instanceof ParticipantCardUniqueViolationError) {
        const raced = await waitForReadyOrGenerating({
          repository: deps.repository,
          registrationId: ctx.registration.id,
          cardType: ctx.dbCardType,
          renderHash: ctx.renderHash,
          now: deps.now,
        });
        if (raced?.status === "READY") {
          const png = await loadPngForRecord(raced, deps.store);
          return buildResult({
            png,
            ctx,
            registration: ctx.registration,
            actor: input.actor,
            cacheStatus: "HIT",
            renderHash: ctx.renderHash,
            durationMs: deps.now().getTime() - startedAt,
            record: raced,
            sourceSummary: summaryFromPreset(ctx.preset),
          });
        }
        record =
          (await deps.repository.findByRegistrationCardTypeHash({
            registrationId: ctx.registration.id,
            cardType: ctx.dbCardType,
            renderHash: ctx.renderHash,
          })) ?? record;
      } else {
        throw err;
      }
    }
  }

  if (!record) {
    throw new Error("PARTICIPANT_CARD_RECORD_MISSING");
  }

  const rate = checkParticipantCardRateLimit({
    actorKind: input.actor.kind,
    userId: input.actor.userId,
    email: input.actor.email,
  });
  if (!rate.allowed) {
    throw cardRateLimited("Demasiadas solicitudes de placas", {
      retryAfterMs: rate.retryAfterMs,
    });
  }

  const doubleReady = await deps.repository.findReadyByHash({
    registrationId: ctx.registration.id,
    cardType: ctx.dbCardType,
    renderHash: ctx.renderHash,
  });
  if (doubleReady) {
    const png = await loadPngForRecord(doubleReady, deps.store);
    return buildResult({
      png,
      ctx,
      registration: ctx.registration,
      actor: input.actor,
      cacheStatus: "HIT",
      renderHash: ctx.renderHash,
      durationMs: deps.now().getTime() - startedAt,
      record: doubleReady,
      sourceSummary: summaryFromPreset(ctx.preset),
    });
  }

  if (record.status !== "GENERATING") {
    if (record.status === "READY") {
      const png = await loadPngForRecord(record, deps.store);
      return buildResult({
        png,
        ctx,
        registration: ctx.registration,
        actor: input.actor,
        cacheStatus: "HIT",
        renderHash: ctx.renderHash,
        durationMs: deps.now().getTime() - startedAt,
        record,
        sourceSummary: summaryFromPreset(ctx.preset),
      });
    }
  }

  try {
    const { document } = resolveClickatonParticipantCardDocument({
      cardType: ctx.cardType,
      templateData: ctx.templateData,
      preset: ctx.preset,
    });

    recordParticipantCardCacheMiss();
    const rendered = await deps.renderProvider.render({ document });
    recordParticipantCardRenderDuration(rendered.durationMs);
    const storageKey = buildParticipantCardStorageKey({
      editionId: ctx.registration.editionId,
      registrationId: ctx.registration.id,
      cardType: ctx.cardType,
      templateVersion: ctx.preset.meta.templateVersion,
      renderHash: ctx.renderHash,
    });

    const generatedAt = deps.now();
    const prefix = renderHashPrefix(ctx.renderHash);
    const putStarted = deps.now().getTime();
    const stored = await deps.store.putAtKey(storageKey, rendered.png, {
      cardType: ctx.cardType,
      templateKey: ctx.preset.meta.templateKey,
      templateVersion: ctx.preset.meta.templateVersion,
      renderHashPrefix: prefix,
      width: rendered.width,
      height: rendered.height,
      mimeType: "image/png",
      generatedAt: generatedAt.toISOString(),
    });
    recordParticipantCardStoragePut(
      deps.now().getTime() - putStarted,
      stored.bytes
    );
    recordParticipantCardStatus("READY");

    const assetId = input.skipPersist
      ? null
      : await deps.persistAsset({
          cardRecordId: record.id,
          registrationId: ctx.registration.id,
          editionId: ctx.registration.editionId,
          storageKey: stored.key,
          publicUrl: stored.publicUrl,
          png: rendered.png,
          width: rendered.width,
          height: rendered.height,
          storageBackend: deps.store.backend,
          templateKey: ctx.preset.meta.templateKey,
          templateVersion: ctx.preset.meta.templateVersion,
          cardType: ctx.cardType,
          renderHashPrefix: prefix,
          prisma: deps.prisma,
        });

    const updated = await deps.repository.updateRecord(record.id, {
      status: "READY",
      assetId,
      storageKey: stored.key,
      width: rendered.width,
      height: rendered.height,
      byteSize: stored.bytes,
      contentHash: stored.contentHash,
      generatedAt,
      lockExpiresAt: null,
      errorCode: null,
      updatedAt: generatedAt,
    });

    await deps.repository.markOtherReadyAsStale({
      registrationId: ctx.registration.id,
      cardType: ctx.dbCardType,
      exceptId: updated.id,
      now: generatedAt,
    });

    recordParticipantCardAudit(
      cacheStatus === "REGENERATED"
        ? "CLICKATON_CARD_REGENERATED"
        : "CLICKATON_CARD_GENERATED",
      {
        registrationId: ctx.registration.id,
        editionId: ctx.registration.editionId,
        cardType: ctx.cardType,
        renderHashPrefix: prefix,
        cacheStatus,
        actorKind: input.actor.kind,
        durationMs: deps.now().getTime() - startedAt,
        recordId: updated.id,
        width: rendered.width,
        height: rendered.height,
        byteSize: stored.bytes,
      }
    );

    return buildResult({
      png: rendered.png,
      ctx,
      registration: ctx.registration,
      actor: input.actor,
      cacheStatus,
      renderHash: ctx.renderHash,
      durationMs: deps.now().getTime() - startedAt,
      record: updated,
      sourceSummary: {
        presetId: ctx.preset.presetId,
        templateKey: ctx.preset.meta.templateKey,
        templateVersion: ctx.preset.meta.templateVersion,
        blockCount: ctx.preset.payload.blocks.length,
        imageCount: ctx.preset.payload.blocks.filter((b) => b.type === "PHOTO")
          .length,
      },
    });
  } catch (err) {
    const failedAt = deps.now();
    await deps.repository.updateRecord(record.id, {
      status: "FAILED",
      failedAt,
      errorCode:
        err instanceof ClickatonCardError ? err.code : "CLICKATON_CARD_RENDER_FAILED",
      lockExpiresAt: null,
      updatedAt: failedAt,
    });
    recordParticipantCardAudit("CLICKATON_CARD_FAILED", {
      registrationId: ctx.registration.id,
      cardType: ctx.cardType,
      renderHashPrefix: renderHashPrefix(ctx.renderHash),
      actorKind: input.actor.kind,
      errorCode:
        err instanceof ClickatonCardError ? err.code : "CLICKATON_CARD_RENDER_FAILED",
      recordId: record.id,
    });
    throw err;
  }
}

function summaryFromPreset(
  preset: ReturnType<typeof getClickatonParticipantCardPreset>
): ParticipantCardSourceSummary {
  return {
    presetId: preset.presetId,
    templateKey: preset.meta.templateKey,
    templateVersion: preset.meta.templateVersion,
    blockCount: preset.payload.blocks.length,
    imageCount: preset.payload.blocks.filter((b) => b.type === "PHOTO").length,
  };
}

function buildResult(input: {
  png: Buffer;
  ctx: {
    cardType: ClickatonParticipantCardType;
    eligibility: ParticipantCardEligibility;
  };
  registration: ParticipantCardRegistrationSnapshot;
  actor: ParticipantCardActor;
  cacheStatus: ParticipantCardCacheStatus;
  renderHash: string;
  durationMs: number;
  record: ParticipantCardRecord;
  sourceSummary: ParticipantCardSourceSummary;
}): GetOrGenerateClickatonParticipantCardResult {
  return {
    png: input.png,
    width: input.record.width ?? 1080,
    height: input.record.height ?? 1920,
    mimeType: "image/png",
    filename: buildParticipantCardFilename(input.ctx.cardType, input.registration),
    cardType: input.ctx.cardType,
    registrationId: input.registration.id,
    eligibility: input.ctx.eligibility,
    warnings: input.ctx.eligibility.warnings,
    durationMs: input.durationMs,
    sourceSummary: input.sourceSummary,
    cacheStatus: input.cacheStatus,
    renderHash: input.renderHash,
    renderHashPrefix: renderHashPrefix(input.renderHash),
    recordId: input.record.id,
    recordStatus: mapRecordStatus(input.record.status),
    generatedAt: input.record.generatedAt,
  };
}

function mapRecordStatus(
  status: ParticipantCardRecord["status"]
): ParticipantCardDbStatus {
  if (status === "READY") return "READY";
  if (status === "GENERATING") return "GENERATING";
  if (status === "FAILED") return "FAILED";
  if (status === "STALE") return "STALE";
  return "NOT_GENERATED";
}

export async function forceRegenerateClickatonParticipantCard(
  input: GenerateClickatonParticipantCardInput,
  depsArg?: ParticipantCardPersistenceDeps
): Promise<GetOrGenerateClickatonParticipantCardResult> {
  const deps = resolveDeps(depsArg);
  const cardType = normalizeParticipantCardType(input.cardType);
  const registration = await deps.loadRegistration(input.registrationId);
  if (!registration) throw cardNotFound();
  requireParticipantCardReadAccess(registration, input.actor);

  await deps.repository.markAllReadyAsStale({
    registrationId: registration.id,
    cardType: toDbCardType(cardType),
    now: deps.now(),
  });

  return getOrGenerateClickatonParticipantCard(
    {
      ...input,
      forceGenerationId: randomUUID(),
    },
    depsArg
  );
}

export async function getClickatonParticipantCardStatus(
  input: {
    registrationId: string;
    cardType: ClickatonParticipantCardType | "WELCOME" | "MEMBER";
    actor: ParticipantCardActor;
  },
  depsArg?: ParticipantCardPersistenceDeps
): Promise<{
  status: ParticipantCardDbStatus;
  renderHash?: string;
  renderHashPrefix?: string;
  generatedAt?: Date | null;
  recordId?: string;
  errorCode?: string | null;
}> {
  const deps = resolveDeps(depsArg);
  const cardType = normalizeParticipantCardType(input.cardType);
  const registration = await deps.loadRegistration(input.registrationId);
  if (!registration) throw cardNotFound();
  requireParticipantCardReadAccess(registration, input.actor);

  const latest = await deps.repository.findLatestForRegistrationCardType({
    registrationId: registration.id,
    cardType: toDbCardType(cardType),
  });

  if (!latest) {
    return { status: "NOT_GENERATED" };
  }

  const status = mapRecordStatus(latest.status);
  return {
    status,
    renderHash: latest.renderHash,
    renderHashPrefix: renderHashPrefix(latest.renderHash),
    generatedAt: latest.generatedAt,
    recordId: latest.id,
    errorCode: latest.errorCode,
  };
}

export type CleanupStaleCardsResult = {
  dryRun: boolean;
  deletedRecords: number;
  deletedAssets: number;
  keptReady: number;
  keptStale: number;
};

export async function cleanupStaleClickatonParticipantCards(
  input: { mode: "dry-run" | "apply"; now?: Date },
  depsArg?: ParticipantCardPersistenceDeps
): Promise<CleanupStaleCardsResult> {
  const deps = resolveDeps(depsArg);
  const now = input.now ?? deps.now();
  const dryRun = input.mode === "dry-run";
  const all = await deps.repository.listForCleanup();

  const groups = new Map<string, ParticipantCardRecord[]>();
  for (const row of all) {
    const key = `${row.registrationId}:${row.cardType}`;
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  let deletedRecords = 0;
  let deletedAssets = 0;
  let keptReady = 0;
  let keptStale = 0;

  for (const rows of groups.values()) {
    const ready = rows
      .filter((r) => r.status === "READY")
      .sort((a, b) => (b.generatedAt?.getTime() ?? 0) - (a.generatedAt?.getTime() ?? 0));
    const stale = rows
      .filter((r) => r.status === "STALE")
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    keptReady += ready.length > 0 ? 1 : 0;
    keptStale += Math.min(stale.length, 2);

    const staleToKeep = new Set(stale.slice(0, 2).map((r) => r.id));
    const readyToKeep = ready[0]?.id;

    for (const row of rows) {
      if (row.status === "READY" && row.id === readyToKeep) continue;
      if (row.status === "STALE" && staleToKeep.has(row.id)) continue;

      if (row.status === "FAILED") {
        const ageMs = now.getTime() - row.updatedAt.getTime();
        const sevenDays = 7 * 24 * 60 * 60 * 1000;
        if (!row.assetId && ageMs > sevenDays) {
          if (!dryRun) await deps.repository.deleteRecord(row.id);
          deletedRecords++;
        }
        continue;
      }

      if (row.status === "STALE") {
        const ageMs = now.getTime() - row.updatedAt.getTime();
        const thirtyDays = 30 * 24 * 60 * 60 * 1000;
        if (ageMs > thirtyDays) {
          if (row.storageKey && !dryRun) {
            try {
              await deps.store.delete(row.storageKey);
              deletedAssets++;
            } catch {
              /* ignore */
            }
          }
          if (!dryRun) await deps.repository.deleteRecord(row.id);
          deletedRecords++;
        }
        continue;
      }

      if (row.status === "READY" && row.id !== readyToKeep) {
        if (row.storageKey && !dryRun) {
          try {
            await deps.store.delete(row.storageKey);
            deletedAssets++;
          } catch {
            /* ignore */
          }
        }
        if (!dryRun) await deps.repository.deleteRecord(row.id);
        deletedRecords++;
      }
    }
  }

  return { dryRun, deletedRecords, deletedAssets, keptReady, keptStale };
}
