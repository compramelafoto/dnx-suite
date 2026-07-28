import { randomUUID } from "node:crypto";
import { buildCaption, isDue, nextRetryAt, planSchedule } from "./scheduling";
import type { SocialPublishProvider } from "./providers/types";
import {
  SocialPublisherError,
  type CreatePublishRequestInput,
  type PublishAttempt,
  type PublishRequest,
  type PublishRequestStatus,
  type SocialAccount,
} from "./types";

export type SocialPublisherStore = {
  requests: Map<string, PublishRequest>;
  byIdempotency: Map<string, string>;
  accounts: Map<string, SocialAccount>;
  /** accountId → access token (tests / memory only; prod usa vault). */
  tokens: Map<string, string>;
  attempts: PublishAttempt[];
  logs: Array<{ at: Date; action: string; requestId: string; meta?: Record<string, unknown> }>;
};

export function createInMemorySocialPublisherStore(): SocialPublisherStore {
  return {
    requests: new Map(),
    byIdempotency: new Map(),
    accounts: new Map(),
    tokens: new Map(),
    attempts: [],
    logs: [],
  };
}

export type SocialPublisherEngine = ReturnType<typeof createSocialPublisherEngine>;

export function createSocialPublisherEngine(
  store: SocialPublisherStore,
  providers: Map<string, SocialPublishProvider>,
  options?: { livePublish?: boolean },
) {
  const livePublish = options?.livePublish === true;

  function log(action: string, requestId: string, meta?: Record<string, unknown>) {
    store.logs.push({ at: new Date(), action, requestId, meta });
  }

  function getRequest(id: string): PublishRequest {
    const r = store.requests.get(id);
    if (!r) throw new SocialPublisherError("NOT_FOUND", "PublishRequest no encontrada");
    return r;
  }

  function save(r: PublishRequest) {
    r.updatedAt = new Date();
    store.requests.set(r.id, r);
  }

  return {
    createRequest(input: CreatePublishRequestInput): PublishRequest {
      const existingId = store.byIdempotency.get(input.idempotencyKey);
      if (existingId) {
        const existing = store.requests.get(existingId);
        if (existing) return existing;
      }
      const account = store.accounts.get(input.target.socialAccountId);
      if (!account) {
        throw new SocialPublisherError("ACCOUNT_NOT_FOUND", "Cuenta social inexistente");
      }
      if (account.platform !== input.target.platform) {
        throw new SocialPublisherError("PLATFORM_MISMATCH", "Plataforma no coincide con la cuenta");
      }

      const approvalRequired = input.approvalRequired !== false;
      const schedule = planSchedule({ scheduleAt: input.scheduleAt ?? null });
      const status: PublishRequestStatus = approvalRequired
        ? "PENDING_APPROVAL"
        : schedule.mode === "SCHEDULED"
          ? "SCHEDULED"
          : "APPROVED";

      const now = new Date();
      const req: PublishRequest = {
        id: randomUUID(),
        application: input.application,
        entityType: input.entityType,
        entityId: input.entityId,
        templateRef: input.templateRef ?? null,
        caption: input.caption,
        hashtags: input.hashtags ?? [],
        mentions: input.mentions ?? [],
        assets: input.assets,
        target: input.target,
        status,
        priority: input.priority ?? "NORMAL",
        approvalRequired,
        scheduleAt: schedule.scheduleAt,
        timezone: input.timezone ?? null,
        approvedAt: approvalRequired ? null : now,
        approvedByUserId: null,
        rejectedAt: null,
        rejectedByUserId: null,
        rejectionReason: null,
        publishedAt: null,
        externalMediaId: null,
        externalPostId: null,
        permalink: null,
        attemptCount: 0,
        nextRetryAt: null,
        lastErrorCode: null,
        lastErrorMessage: null,
        idempotencyKey: input.idempotencyKey,
        metadata: input.metadata ?? {},
        createdByUserId: input.createdByUserId ?? null,
        createdAt: now,
        updatedAt: now,
      };
      store.requests.set(req.id, req);
      store.byIdempotency.set(input.idempotencyKey, req.id);
      log("CREATED", req.id, { status: req.status, application: req.application });
      return req;
    },

    approve(requestId: string, actorUserId: number): PublishRequest {
      const r = getRequest(requestId);
      if (r.status !== "PENDING_APPROVAL" && r.status !== "DRAFT") {
        throw new SocialPublisherError("INVALID_STATE", `No se puede aprobar desde ${r.status}`);
      }
      const schedule = planSchedule({ scheduleAt: r.scheduleAt });
      r.status = schedule.mode === "SCHEDULED" ? "SCHEDULED" : "APPROVED";
      r.approvedAt = new Date();
      r.approvedByUserId = actorUserId;
      r.rejectedAt = null;
      r.rejectionReason = null;
      save(r);
      log("APPROVED", r.id, { actorUserId, status: r.status });
      return r;
    },

    reject(requestId: string, actorUserId: number, reason?: string): PublishRequest {
      const r = getRequest(requestId);
      if (!["PENDING_APPROVAL", "DRAFT", "APPROVED", "SCHEDULED"].includes(r.status)) {
        throw new SocialPublisherError("INVALID_STATE", `No se puede rechazar desde ${r.status}`);
      }
      r.status = "REJECTED";
      r.rejectedAt = new Date();
      r.rejectedByUserId = actorUserId;
      r.rejectionReason = reason?.slice(0, 200) ?? null;
      save(r);
      log("REJECTED", r.id, { actorUserId });
      return r;
    },

    schedule(requestId: string, scheduleAt: Date, timezone?: string | null): PublishRequest {
      const r = getRequest(requestId);
      if (!["APPROVED", "SCHEDULED", "PENDING_APPROVAL"].includes(r.status)) {
        throw new SocialPublisherError("INVALID_STATE", `No se puede programar desde ${r.status}`);
      }
      const plan = planSchedule({ scheduleAt });
      r.scheduleAt = plan.scheduleAt;
      r.timezone = timezone ?? r.timezone;
      if (r.status === "APPROVED" || r.status === "SCHEDULED") {
        r.status = plan.mode === "SCHEDULED" ? "SCHEDULED" : "APPROVED";
      }
      save(r);
      log("RESCHEDULED", r.id, { scheduleAt: r.scheduleAt?.toISOString() });
      return r;
    },

    cancel(requestId: string): PublishRequest {
      const r = getRequest(requestId);
      if (r.status === "PUBLISHED") {
        throw new SocialPublisherError("INVALID_STATE", "Ya publicada");
      }
      r.status = "CANCELLED";
      save(r);
      log("CANCELLED", r.id);
      return r;
    },

    duplicate(requestId: string): PublishRequest {
      const r = getRequest(requestId);
      return this.createRequest({
        application: r.application,
        entityType: r.entityType,
        entityId: r.entityId,
        templateRef: r.templateRef,
        caption: r.caption,
        hashtags: r.hashtags,
        mentions: r.mentions,
        assets: r.assets,
        target: r.target,
        scheduleAt: null,
        timezone: r.timezone,
        approvalRequired: true,
        priority: r.priority,
        metadata: { ...r.metadata, duplicatedFrom: r.id },
        idempotencyKey: `dup:${r.id}:${randomUUID()}`,
        createdByUserId: r.createdByUserId,
      });
    },

    updateAssets(requestId: string, assets: PublishRequest["assets"]): PublishRequest {
      const r = getRequest(requestId);
      if (["PUBLISHED", "PUBLISHING", "CANCELLED"].includes(r.status)) {
        throw new SocialPublisherError("INVALID_STATE", "No se pueden cambiar assets");
      }
      r.assets = assets;
      save(r);
      log("ASSETS_UPDATED", r.id);
      return r;
    },

    async processDue(now = new Date(), limit = 25): Promise<number> {
      const due = [...store.requests.values()]
        .filter((r) => {
          if (r.status === "APPROVED" || r.status === "SCHEDULED") {
            return isDue(r.scheduleAt, now);
          }
          if (r.status === "FAILED" && r.nextRetryAt != null) {
            return isDue(r.nextRetryAt, now);
          }
          return false;
        })
        .slice(0, limit);

      let n = 0;
      for (const r of due) {
        await this.processOne(r.id);
        n += 1;
      }
      return n;
    },

    async processOne(requestId: string): Promise<PublishRequest> {
      const r = getRequest(requestId);
      if (!["APPROVED", "SCHEDULED", "FAILED"].includes(r.status)) {
        throw new SocialPublisherError("INVALID_STATE", `Worker no procesa ${r.status}`);
      }
      if (!isDue(r.scheduleAt)) {
        throw new SocialPublisherError("NOT_DUE", "Aún no programada");
      }
      if (!r.assets.some((a) => a.publicUrl)) {
        throw new SocialPublisherError("ASSETS_NOT_READY", "Assets sin publicUrl", true);
      }

      const account = store.accounts.get(r.target.socialAccountId);
      if (!account) throw new SocialPublisherError("ACCOUNT_NOT_FOUND", "Cuenta inexistente");
      const token = store.tokens.get(account.id);
      if (!token) throw new SocialPublisherError("TOKEN_MISSING", "Token no disponible", true);

      const provider = providers.get(r.target.platform);
      if (!provider) {
        throw new SocialPublisherError("PROVIDER_MISSING", `Sin adapter para ${r.target.platform}`);
      }

      r.status = "PUBLISHING";
      r.attemptCount += 1;
      save(r);

      const started = Date.now();
      const attemptId = randomUUID();
      const dryRun = !livePublish;

      try {
        const caption = buildCaption({
          caption: r.caption,
          hashtags: r.hashtags,
          mentions: r.mentions,
        });
        const result = await provider.publish({
          account,
          accessToken: token,
          caption,
          assets: r.assets,
          dryRun,
        });
        if (!result.ok) {
          throw new SocialPublisherError(
            result.errorCode ?? "PUBLISH_FAILED",
            result.errorMessage ?? "falló publish",
            true,
          );
        }
        r.status = "PUBLISHED";
        r.publishedAt = new Date();
        r.externalMediaId = result.externalMediaId ?? null;
        r.externalPostId = result.externalPostId ?? null;
        r.permalink = result.permalink ?? null;
        r.lastErrorCode = null;
        r.lastErrorMessage = null;
        r.nextRetryAt = null;
        save(r);
        store.attempts.push({
          id: attemptId,
          publishRequestId: r.id,
          attemptNumber: r.attemptCount,
          startedAt: new Date(started),
          finishedAt: new Date(),
          ok: true,
          dryRun,
          errorCode: null,
          errorMessage: null,
          durationMs: Date.now() - started,
        });
        log("PUBLISHED", r.id, {
          dryRun,
          externalPostId: r.externalPostId,
          // sin token
        });
        return r;
      } catch (err) {
        const code = err instanceof SocialPublisherError ? err.code : "PUBLISH_FAILED";
        const message = err instanceof Error ? err.message.slice(0, 200) : "unknown";
        const retryable = err instanceof SocialPublisherError ? err.retryable : true;
        r.status = "FAILED";
        r.lastErrorCode = code;
        r.lastErrorMessage = message;
        r.nextRetryAt = retryable ? nextRetryAt(r.attemptCount) : null;
        save(r);
        store.attempts.push({
          id: attemptId,
          publishRequestId: r.id,
          attemptNumber: r.attemptCount,
          startedAt: new Date(started),
          finishedAt: new Date(),
          ok: false,
          dryRun,
          errorCode: code,
          errorMessage: message,
          durationMs: Date.now() - started,
        });
        log("FAILED", r.id, { code, retryable });
        return r;
      }
    },

    list(filters?: {
      status?: PublishRequestStatus;
      application?: string;
      socialAccountId?: string;
    }): PublishRequest[] {
      return [...store.requests.values()].filter((r) => {
        if (filters?.status && r.status !== filters.status) return false;
        if (filters?.application && r.application !== filters.application) return false;
        if (
          filters?.socialAccountId &&
          r.target.socialAccountId !== filters.socialAccountId
        ) {
          return false;
        }
        return true;
      });
    },
  };
}
