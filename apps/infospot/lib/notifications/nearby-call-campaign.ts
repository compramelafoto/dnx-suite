/**
 * Integración InfoSpot → DNX Notifications Engine
 * Evento: CLF_PHOTOGRAPHER_CALL_OPENED (idempotente, sin envío automático).
 */

import { prisma, Role, Prisma } from "@repo/db";
import {
  NotificationEngine,
  audiencePreviewSummary,
  createNotificationEvent,
  resolveAvailableChannels,
  defaultPreferenceForLegacyUser,
  shouldEmitPhotographerCallOpened,
  buildDeliveryDedupeKey,
  renderNearbyPhotographerCallTemplate,
  renderNearbyCallEmail,
  type PhotographerAudienceInput,
  type AudiencePreview,
  type NotificationChannel,
} from "@repo/notifications";
import { randomBytes } from "node:crypto";
import { isCallOpenForNotify } from "./call-open";
import { isNotificationCampaignsEnabled } from "./feature-flags";
import { runNotificationWorker } from "./worker";

export { isCallOpenForNotify };

const engine = new NotificationEngine();

export type NearbyNotifyScopeInput = {
  mode: "RADIUS_KM" | "CITY" | "PROVINCE";
  km?: number | null;
};

function formatDateLabel(d: Date | null | undefined): string | null {
  if (!d) return null;
  try {
    return new Intl.DateTimeFormat("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(d);
  } catch {
    return null;
  }
}

/** Registra el hecho OPENED sin enviar campañas (idempotente). */
export async function recordPhotographerCallOpenedEvent(input: {
  callId: string;
  previousProvisioningStatus: string | null;
  nextProvisioningStatus: string;
  enabled: boolean;
  visibility: string;
  joinPolicy: string;
  desiredClfStatus: string;
  clfEventId: number | null;
  maxPhotographers: number | null;
  payload?: Record<string, unknown>;
}): Promise<{ recorded: boolean; idempotencyKey: string | null }> {
  const should = shouldEmitPhotographerCallOpened({
    previousProvisioningStatus: input.previousProvisioningStatus,
    nextProvisioningStatus: input.nextProvisioningStatus,
    enabled: input.enabled,
    visibility: input.visibility,
    joinPolicy: input.joinPolicy,
    desiredClfStatus: input.desiredClfStatus,
    clfEventId: input.clfEventId,
    maxPhotographers: input.maxPhotographers,
  });
  if (!should) return { recorded: false, idempotencyKey: null };

  const event = createNotificationEvent({
    type: "CLF_PHOTOGRAPHER_CALL_OPENED",
    sourceApp: "infospot",
    sourceEntityType: "InfoSpotPhotographerCall",
    sourceEntityId: input.callId,
    cycle: "open",
    payload: input.payload ?? { clfEventId: input.clfEventId },
  });

  try {
    await prisma.dnxNotificationEventLog.create({
      data: {
        eventType: event.type,
        sourceApp: event.sourceApp,
        sourceEntityType: event.sourceEntityType,
        sourceEntityId: event.sourceEntityId,
        idempotencyKey: event.idempotencyKey,
        payloadJson: event.payload as Prisma.InputJsonValue,
      },
    });
    return { recorded: true, idempotencyKey: event.idempotencyKey };
  } catch (err) {
    // Unique violation → ya registrado
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("Unique") || msg.includes("idempotencyKey")) {
      return { recorded: false, idempotencyKey: event.idempotencyKey };
    }
    throw err;
  }
}

async function loadPhotographersForAudience(input: {
  clfEventId: number | null;
  campaignCycle: string;
  sourceEntityId: string;
}): Promise<PhotographerAudienceInput[]> {
  const users = await prisma.user.findMany({
    where: {
      role: { in: [Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER] },
    },
    select: {
      id: true,
      isBlocked: true,
      latitude: true,
      longitude: true,
      city: true,
      province: true,
      dnxNotificationPreference: true,
    },
  });

  const appliedIds = new Set<number>();
  if (input.clfEventId) {
    const members = await prisma.eventMember.findMany({
      where: {
        eventId: input.clfEventId,
        status: { in: ["ACTIVE", "PENDING"] },
      },
      select: { userId: true },
    });
    for (const m of members) appliedIds.add(m.userId);
  }

  const existingDeliveries = await prisma.dnxNotificationDelivery.findMany({
    where: {
      dedupeKey: {
        startsWith: `CLF_PHOTOGRAPHER_CALL_OPENED:${input.sourceEntityId}:`,
      },
    },
    select: { dedupeKey: true, userId: true },
  });
  const existingByUser = new Map<number, string[]>();
  for (const d of existingDeliveries) {
    const list = existingByUser.get(d.userId) ?? [];
    list.push(d.dedupeKey);
    existingByUser.set(d.userId, list);
  }

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recent = await prisma.dnxNotificationDelivery.groupBy({
    by: ["userId"],
    where: {
      createdAt: { gte: weekAgo },
      campaign: { eventType: "CLF_PHOTOGRAPHER_CALL_OPENED" },
      status: { in: ["SENT", "PENDING", "PROCESSING"] },
    },
    _count: { _all: true },
  });
  const recentMap = new Map(recent.map((r) => [r.userId, r._count._all]));

  return users.map((u) => {
    const prefRow = u.dnxNotificationPreference;
    const pref = prefRow
      ? {
          ...defaultPreferenceForLegacyUser(),
          nearbyPhotographerCalls: prefRow.nearbyPhotographerCalls,
          channels: {
            inApp: prefRow.channelInApp,
            email: prefRow.channelEmail,
            webPush: prefRow.channelWebPush,
          },
          externalMarketingConsentAt: prefRow.externalMarketingConsentAt,
        }
      : defaultPreferenceForLegacyUser();

    return {
      userId: u.id,
      kind: "PHOTOGRAPHER" as const,
      active: !u.isBlocked,
      blocked: u.isBlocked,
      latitude: u.latitude,
      longitude: u.longitude,
      city: u.city,
      province: u.province,
      nearbyCallsEnabled: pref.nearbyPhotographerCalls,
      availableChannels: resolveAvailableChannels(pref, {
        emailInfrastructureReady: true,
      }),
      alreadyApplied: appliedIds.has(u.id),
      existingDedupeKeys: existingByUser.get(u.id) ?? [],
      recentSimilarCount: recentMap.get(u.id) ?? 0,
    };
  });
}

export type NearbyAudiencePreviewResult = {
  ok: true;
  summary: string;
  buckets: AudiencePreview["buckets"];
  byDistanceKm: Record<string, number>;
  byCity: Record<string, number>;
  byChannel: Record<string, number>;
  warnings: string[];
  city: string;
  province: string;
  eventHasCoords: boolean;
  channels: NotificationChannel[];
  emailPreview: { subject: string; htmlSnippet: string };
  inAppPreview: { title: string; body: string; ctaLabel: string };
  scopeLabel: string;
  confirmationText: string;
  callOpen: boolean;
  eventTitle: string;
  publicUrl: string;
} | { ok: false; error: string };

export async function previewNearbyPhotographerAudience(input: {
  infoSpotEventId: string;
  scope: NearbyNotifyScopeInput;
  actorIsDirectorOrSuperAdmin: boolean;
  channels?: NotificationChannel[];
  title?: string | null;
  body?: string | null;
}): Promise<NearbyAudiencePreviewResult> {
  const event = await prisma.infoSpotEvent.findUnique({
    where: { id: input.infoSpotEventId },
    include: { photographerCall: true },
  });
  if (!event?.photographerCall) {
    return { ok: false, error: "No hay convocatoria configurada." };
  }
  const call = event.photographerCall;
  const eventEnded =
    Boolean(event.endAt && event.endAt.getTime() < Date.now()) ||
    (Boolean(event.startAt) &&
      !event.endAt &&
      event.startAt.getTime() + 24 * 60 * 60 * 1000 < Date.now());
  const missingGeoref =
    event.latitude == null ||
    event.longitude == null ||
    !Number.isFinite(event.latitude) ||
    !Number.isFinite(event.longitude);

  const callOpen = isCallOpenForNotify({
    enabled: call.enabled,
    provisioningStatus: call.provisioningStatus,
    desiredClfStatus: call.desiredClfStatus,
    clfEventId: call.clfEventId,
    publicUrl: call.publicUrl,
    eventEnded,
    missingGeoref,
  });

  if (!call.publicUrl) {
    return { ok: false, error: "La convocatoria no tiene URL pública en CLF." };
  }

  const requestedChannels: NotificationChannel[] = (
    input.channels?.length ? input.channels : (["IN_APP"] as NotificationChannel[])
  ).filter((c) => c === "IN_APP" || c === "EMAIL");

  const scope = engine.parseScope(input.scope);
  const campaignCycle = `manual-${Date.now()}`; // preview ephemeral cycle for draft key only
  const photographers = await loadPhotographersForAudience({
    clfEventId: call.clfEventId,
    campaignCycle: "preview",
    sourceEntityId: call.id,
  });

  const recentSimilarByUserId = new Map(
    photographers
      .filter((p) => (p.recentSimilarCount ?? 0) > 0)
      .map((p) => [p.userId, p.recentSimilarCount ?? 0] as const),
  );

  const draft = engine.buildCampaignDraft({
    event: createNotificationEvent({
      type: "CLF_PHOTOGRAPHER_CALL_OPENED",
      sourceApp: "infospot",
      sourceEntityType: "InfoSpotPhotographerCall",
      sourceEntityId: call.id,
    }),
    photographers,
    audienceContext: {
      eventType: "CLF_PHOTOGRAPHER_CALL_OPENED",
      sourceEntityId: call.id,
      campaignCycle,
      origin: {
        latitude: event.latitude,
        longitude: event.longitude,
        city: event.city,
        province: event.province,
      },
      scope,
      channels: requestedChannels,
      callOpen,
      callExpired: eventEnded,
    },
    templateVars: {
      eventName: event.title,
      city: event.city,
      province: event.province,
      dateLabel: formatDateLabel(event.startAt),
      photographersNeeded: call.maxPhotographers,
      url: call.publicUrl,
    },
    templateOverrides: { title: input.title, body: input.body },
    policyContext: {
      campaignsForSourceEntity: 0,
      campaignsByActorToday: 0,
      actorIsDirectorOrSuperAdmin: input.actorIsDirectorOrSuperAdmin,
      callOpen,
      callExpired: eventEnded,
    },
    centerLabel: event.city || event.province || "ubicación del evento",
    eventTitle: event.title,
    recentSimilarByUserId,
  });

  const byChannel: Record<string, number> = { IN_APP: 0, EMAIL: 0 };
  for (const candidate of draft.preview.eligible) {
    const uid = candidate.recipient.userId;
    if (uid == null) continue;
    const photo = photographers.find((p) => p.userId === Number(uid));
    if (!photo) continue;
    for (const ch of requestedChannels) {
      if (photo.availableChannels.includes(ch)) {
        byChannel[ch] = (byChannel[ch] ?? 0) + 1;
      }
    }
  }

  const warnings: string[] = [];
  if (!callOpen) {
    warnings.push("La convocatoria no está abierta: no se puede enviar.");
  }
  if (eventEnded) {
    warnings.push("El evento está vencido.");
  }
  if (missingGeoref) {
    warnings.push(
      "El evento no tiene coordenadas suficientes; el alcance geográfico puede ser engañoso o bloquearse.",
    );
  }
  if (draft.preview.buckets.eligible === 0) {
    warnings.push("No hay destinatarios elegibles con este alcance.");
  }
  if (requestedChannels.includes("EMAIL") && (byChannel.EMAIL ?? 0) === 0) {
    warnings.push("EMAIL solicitado pero no hay destinatarios con opt-in.");
  }

  const rendered = renderNearbyPhotographerCallTemplate(
    {
      eventName: event.title,
      city: event.city,
      province: event.province,
      dateLabel: formatDateLabel(event.startAt),
      photographersNeeded: call.maxPhotographers,
      url: call.publicUrl,
    },
    { title: input.title, body: input.body },
  );
  const email = renderNearbyCallEmail({
    eventName: event.title,
    city: event.city,
    province: event.province,
    dateLabel: formatDateLabel(event.startAt),
    photographersNeeded: call.maxPhotographers,
    ctaUrl: call.publicUrl,
    prefsUrl: "https://compramelafoto.com/fotografo/configuracion/notificaciones",
    body: rendered.body,
  });

  return {
    ok: true,
    summary: audiencePreviewSummary(draft.preview),
    buckets: draft.preview.buckets,
    byDistanceKm: draft.preview.byDistanceKm,
    byCity: draft.preview.byCity,
    byChannel,
    warnings,
    city: event.city,
    province: event.province,
    eventHasCoords: !missingGeoref,
    channels: requestedChannels,
    emailPreview: {
      subject: email.subject,
      htmlSnippet: email.html.slice(0, 400),
    },
    inAppPreview: {
      title: rendered.title,
      body: rendered.body,
      ctaLabel: rendered.ctaLabel,
    },
    scopeLabel: draft.preview.scopeLabel,
    confirmationText: draft.confirmationText,
    callOpen,
    eventTitle: event.title,
    publicUrl: call.publicUrl,
  };
}

export type SendNearbyCampaignResult =
  | {
      ok: true;
      campaignId: string;
      eligibleCount: number;
      queued: number;
      processed: number;
      sent: number;
      failed: number;
      confirmationText: string;
    }
  | { ok: false; error: string; code?: string };

function newPublicToken(): string {
  return `nt_${randomBytes(18).toString("base64url")}`;
}

export async function confirmAndSendNearbyCampaign(input: {
  infoSpotEventId: string;
  scope: NearbyNotifyScopeInput;
  actorUserId: number;
  actorIsDirectorOrSuperAdmin: boolean;
  title?: string | null;
  body?: string | null;
  confirmed: boolean;
  campaignCycle?: string;
  /** Canales solicitados por el editor (filtrados por elegibilidad). */
  channels?: NotificationChannel[];
  /** Si true, dispara un lote del worker tras persistir (default true). */
  runWorkerAfterQueue?: boolean;
}): Promise<SendNearbyCampaignResult> {
  if (!input.confirmed) {
    return { ok: false, error: "Se requiere confirmación explícita.", code: "NOT_CONFIRMED" };
  }

  if (!isNotificationCampaignsEnabled()) {
    return {
      ok: false,
      error: "Campañas de notificación deshabilitadas (kill switch).",
      code: "FEATURE_DISABLED",
    };
  }

  const event = await prisma.infoSpotEvent.findUnique({
    where: { id: input.infoSpotEventId },
    include: { photographerCall: true },
  });
  if (!event?.photographerCall) {
    return { ok: false, error: "No hay convocatoria configurada." };
  }
  const call = event.photographerCall;
  if (!call.publicUrl || !call.clfEventId) {
    return { ok: false, error: "La convocatoria no está abierta en CLF." };
  }

  const eventEnded =
    Boolean(event.endAt && event.endAt.getTime() < Date.now()) ||
    (Boolean(event.startAt) &&
      !event.endAt &&
      event.startAt.getTime() + 24 * 60 * 60 * 1000 < Date.now());
  const missingGeoref =
    event.latitude == null ||
    event.longitude == null ||
    !Number.isFinite(event.latitude) ||
    !Number.isFinite(event.longitude);

  const callOpen = isCallOpenForNotify({
    enabled: call.enabled,
    provisioningStatus: call.provisioningStatus,
    desiredClfStatus: call.desiredClfStatus,
    clfEventId: call.clfEventId,
    publicUrl: call.publicUrl,
    eventEnded,
    missingGeoref,
  });
  if (!callOpen) {
    return { ok: false, error: "La convocatoria no está abierta.", code: "CALL_CLOSED" };
  }
  if (eventEnded) {
    return { ok: false, error: "El evento está vencido.", code: "CALL_EXPIRED" };
  }

  const scope = engine.parseScope(input.scope);
  const campaignCycle =
    input.campaignCycle?.trim() || `send-${Date.now()}`;

  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const [campaignsForSource, campaignsByActorToday] = await Promise.all([
    prisma.dnxNotificationCampaign.count({
      where: {
        sourceEntityType: "InfoSpotPhotographerCall",
        sourceEntityId: call.id,
        status: { in: ["QUEUED", "PROCESSING", "COMPLETED"] },
      },
    }),
    prisma.dnxNotificationCampaign.count({
      where: {
        createdByUserId: input.actorUserId,
        confirmedAt: { gte: dayStart },
        status: { in: ["QUEUED", "PROCESSING", "COMPLETED"] },
      },
    }),
  ]);

  const photographers = await loadPhotographersForAudience({
    clfEventId: call.clfEventId,
    campaignCycle,
    sourceEntityId: call.id,
  });
  const recentSimilarByUserId = new Map(
    photographers.map((p) => [p.userId, p.recentSimilarCount ?? 0] as const),
  );

  const notifEvent = createNotificationEvent({
    type: "CLF_PHOTOGRAPHER_CALL_OPENED",
    sourceApp: "infospot",
    sourceEntityType: "InfoSpotPhotographerCall",
    sourceEntityId: call.id,
    cycle: "open",
  });

  const requestedChannels: NotificationChannel[] = (
    input.channels?.length ? input.channels : (["IN_APP"] as NotificationChannel[])
  ).filter((c) => c === "IN_APP" || c === "EMAIL");

  const draft = engine.buildCampaignDraft({
    event: notifEvent,
    photographers,
    audienceContext: {
      eventType: "CLF_PHOTOGRAPHER_CALL_OPENED",
      sourceEntityId: call.id,
      campaignCycle,
      origin: {
        latitude: event.latitude,
        longitude: event.longitude,
        city: event.city,
        province: event.province,
      },
      scope,
      channels: requestedChannels,
      callOpen: true,
      callExpired: false,
    },
    templateVars: {
      eventName: event.title,
      city: event.city,
      province: event.province,
      dateLabel: formatDateLabel(event.startAt),
      photographersNeeded: call.maxPhotographers,
      url: call.publicUrl,
    },
    templateOverrides: { title: input.title, body: input.body },
    policyContext: {
      campaignsForSourceEntity: campaignsForSource,
      campaignsByActorToday,
      actorIsDirectorOrSuperAdmin: input.actorIsDirectorOrSuperAdmin,
      callOpen: true,
      callExpired: false,
    },
    centerLabel: event.city || event.province || "ubicación del evento",
    eventTitle: event.title,
    recentSimilarByUserId,
  });

  if (!draft.policy.ok) {
    return { ok: false, error: draft.policy.error, code: draft.policy.code };
  }
  if (draft.preview.buckets.eligible === 0) {
    return {
      ok: false,
      error: "No hay destinatarios elegibles. Ajustá el alcance o revisá preferencias.",
      code: "EMPTY_AUDIENCE",
    };
  }
  if (requestedChannels.includes("EMAIL")) {
    const emailEligible = draft.preview.eligible.filter((c) => {
      const uid = c.recipient.userId;
      if (uid == null) return false;
      const photo = photographers.find((p) => p.userId === Number(uid));
      return Boolean(photo?.availableChannels.includes("EMAIL"));
    }).length;
    if (emailEligible === 0) {
      return {
        ok: false,
        error: "EMAIL sin destinatarios con opt-in. Desmarcá EMAIL o ampliá la audiencia.",
        code: "EMAIL_NO_OPTIN",
      };
    }
  }

  // Persistir campaña + entregas PENDING (outbox). El worker materializa IN_APP/EMAIL.
  let campaign;
  try {
    const rendered = renderNearbyPhotographerCallTemplate(
      {
        eventName: event.title,
        city: event.city,
        province: event.province,
        dateLabel: formatDateLabel(event.startAt),
        photographersNeeded: call.maxPhotographers,
        url: call.publicUrl,
      },
      { title: input.title, body: input.body },
    );
    const photoById = new Map(photographers.map((p) => [p.userId, p]));
    const deliveryCreates: Array<{
      userId: number;
      channel: "IN_APP" | "EMAIL";
      status: "PENDING";
      attempts: number;
      dedupeKey: string;
      publicToken: string;
      title: string;
      body: string;
      ctaUrl: string;
      ctaLabel: string;
      scheduledAt: Date;
      distanceKm: number | null;
      citySnapshot: string | null;
    }> = [];

    for (const candidate of draft.preview.eligible) {
      if (candidate.recipient.userId == null) continue;
      const userId = Number(candidate.recipient.userId);
      const photo = photoById.get(userId);
      if (!photo) continue;
      for (const ch of requestedChannels) {
        if (!photo.availableChannels.includes(ch)) continue;
        if (ch !== "IN_APP" && ch !== "EMAIL") continue;
        deliveryCreates.push({
          userId,
          channel: ch,
          status: "PENDING",
          attempts: 0,
          dedupeKey: buildDeliveryDedupeKey({
            eventType: "CLF_PHOTOGRAPHER_CALL_OPENED",
            sourceEntityId: call.id,
            recipientUserId: userId,
            channel: ch,
            campaignCycle,
          }),
          publicToken: newPublicToken(),
          title: rendered.title,
          body: rendered.body,
          ctaUrl: call.publicUrl,
          ctaLabel: rendered.ctaLabel,
          scheduledAt: draft.schedule.scheduledAt,
          distanceKm: candidate.distanceKm,
          citySnapshot: candidate.city,
        });
      }
    }

    campaign = await prisma.dnxNotificationCampaign.create({
      data: {
        eventType: notifEvent.type,
        sourceApp: "infospot",
        sourceEntityType: "InfoSpotPhotographerCall",
        sourceEntityId: call.id,
        clfEventId: call.clfEventId,
        status: "QUEUED",
        campaignCycle,
        campaignDedupeKey: draft.campaignDedupeKey,
        scopeMode: scope.kind,
        radiusKm: scope.kind === "RADIUS_KM" ? scope.km : null,
        centerCity: event.city,
        centerProvince: event.province,
        centerLatitude: event.latitude,
        centerLongitude: event.longitude,
        channels: requestedChannels,
        title: draft.deliveries[0]?.title ?? "Buscan fotógrafos cerca tuyo",
        body: draft.deliveries[0]?.body ?? "",
        ctaUrl: call.publicUrl,
        ctaLabel: draft.deliveries[0]?.ctaLabel ?? "Ver convocatoria",
        createdByUserId: input.actorUserId,
        confirmedByUserId: input.actorUserId,
        confirmedAt: new Date(),
        scheduledAt: draft.schedule.scheduledAt,
        audienceCount: draft.metrics.audience_count,
        eligibleCount: draft.metrics.eligible_count,
        excludedCount: draft.preview.buckets.excluded,
        filtersJson: {
          scope,
          channels: requestedChannels,
        },
        exclusionSummaryJson: draft.preview.buckets,
        confirmationSummary: draft.confirmationText,
        deliveries: { create: deliveryCreates },
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("campaignDedupeKey") || msg.includes("Unique")) {
      return {
        ok: false,
        error: "Ya existe una campaña con este ciclo. Usá un nuevo ciclo o revisá métricas.",
        code: "DUPLICATE_CAMPAIGN",
      };
    }
    throw err;
  }

  const queued = await prisma.dnxNotificationDelivery.count({
    where: { campaignId: campaign.id, status: "PENDING" },
  });

  let sent = 0;
  let failed = 0;
  let processed = 0;
  if (input.runWorkerAfterQueue !== false) {
    const run = await runNotificationWorker({ batchSize: Math.min(100, Math.max(queued, 1)) });
    sent = run.sent;
    failed = run.failed;
    processed = run.claimed;
  }

  return {
    ok: true,
    campaignId: campaign.id,
    eligibleCount: draft.metrics.eligible_count,
    queued,
    processed,
    sent,
    failed,
    confirmationText: draft.confirmationText,
  };
}
