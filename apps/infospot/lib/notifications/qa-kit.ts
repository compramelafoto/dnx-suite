/**
 * Kit QA Etapa 20 — seed/cleanup con gates.
 * Prefijo visible: [QA NOTIFICATIONS]
 * Tag User.tags / filtersJson: QA_NOTIFICATIONS_ETAPA20
 */

import { prisma, Role } from "@repo/db";
import { randomBytes } from "node:crypto";
import { hashSync } from "bcryptjs";

export const QA_TAG = "QA_NOTIFICATIONS_ETAPA20";
export const QA_PREFIX = "[QA NOTIFICATIONS]";
export const QA_EMAIL_DOMAIN = "dnx-qa-notifications.invalid";

/** Password QA browser (bcrypt). Override con DNX_NOTIFICATIONS_QA_PASSWORD. */
export function resolveQaPassword(): string {
  const fromEnv = process.env.DNX_NOTIFICATIONS_QA_PASSWORD?.trim();
  if (fromEnv && fromEnv.length >= 10) return fromEnv;
  return "QaNotif!e2e-local-21";
}

export function assertQaGate() {
  if (process.env.DNX_NOTIFICATIONS_QA_ALLOW_SEED !== "1") {
    throw new Error("Set DNX_NOTIFICATIONS_QA_ALLOW_SEED=1");
  }
  if (process.env.NODE_ENV === "production" && process.env.DNX_NOTIFICATIONS_QA_FORCE_PROD !== "1") {
    throw new Error("Bloqueado en production (NODE_ENV=production).");
  }
  const url = process.env.DATABASE_URL || "";
  if (/prod-primary|production-primary/i.test(url)) {
    throw new Error("Host parece producción primaria. Abortado.");
  }
}

function clfPublicBase(): string {
  return (
    process.env.NEXT_PUBLIC_CLF_SITE_URL ||
    process.env.CLF_PUBLIC_SITE_URL ||
    "http://127.0.0.1:3002"
  ).replace(/\/$/, "");
}

const ROSARIO = { lat: -32.9442, lng: -60.6505, city: "Rosario", province: "Santa Fe" };

/** Offsets ~km en latitud (1° ≈ 111 km). */
function offsetKm(base: { lat: number; lng: number }, kmNorth: number) {
  return {
    lat: base.lat + kmNorth / 111,
    lng: base.lng,
  };
}

export type QaSeedManifest = {
  tag: string;
  photographerUserIds: number[];
  infoSpotEventIds: string[];
  photographerCallIds: string[];
  clfEventIds: number[];
  campaignIds: string[];
  actorUserId: number | null;
};

function qaEmail(key: string) {
  return `qa-notif-${key}@${QA_EMAIL_DOMAIN}`;
}

async function upsertQaPhotographer(input: {
  key: string;
  name: string;
  lat: number | null;
  lng: number | null;
  city: string | null;
  province: string | null;
  blocked?: boolean;
  nearby?: boolean;
  channelInApp?: boolean;
  channelEmail?: boolean;
  emailBroken?: boolean;
}) {
  const email = input.emailBroken ? `invalid-${input.key}@${QA_EMAIL_DOMAIN}` : qaEmail(input.key);
  const passwordHash = hashSync(resolveQaPassword(), 10);
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: {
          email,
          name: `${QA_PREFIX} ${input.name}`,
          role: Role.PHOTOGRAPHER,
          password: passwordHash,
          isBlocked: Boolean(input.blocked),
          latitude: input.lat,
          longitude: input.lng,
          city: input.city,
          province: input.province,
          tags: { set: [QA_TAG] },
        },
      })
    : await prisma.user.create({
        data: {
          email,
          name: `${QA_PREFIX} ${input.name}`,
          role: Role.PHOTOGRAPHER,
          isBlocked: Boolean(input.blocked),
          latitude: input.lat,
          longitude: input.lng,
          city: input.city,
          province: input.province,
          tags: [QA_TAG],
          password: passwordHash,
        },
      });

  await prisma.dnxNotificationPreference.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      nearbyPhotographerCalls: input.nearby !== false,
      channelInApp: input.channelInApp !== false,
      channelEmail: Boolean(input.channelEmail),
      externalMarketingConsentAt: input.channelEmail ? new Date() : null,
      preferredScopeMode: "RADIUS_KM",
      preferredRadiusKm: 50,
    },
    update: {
      nearbyPhotographerCalls: input.nearby !== false,
      channelInApp: input.channelInApp !== false,
      channelEmail: Boolean(input.channelEmail),
      externalMarketingConsentAt: input.channelEmail ? new Date() : null,
    },
  });

  return user.id;
}

async function resolveActorUserId(): Promise<number> {
  const director = await prisma.infoSpotUserRole.findFirst({
    where: { role: "INFOSPOT_DIRECTOR", status: "ACTIVE" },
    select: { userId: true },
  });
  if (director) return director.userId;
  const superAdmin = await prisma.user.findFirst({
    where: { globalRole: "SUPER_ADMIN" },
    select: { id: true },
  });
  if (superAdmin) return superAdmin.id;
  const any = await prisma.user.findFirst({ select: { id: true }, orderBy: { id: "asc" } });
  if (!any) throw new Error("No hay usuarios en DB para actor QA.");
  return any.id;
}

async function ensureCategory(): Promise<string> {
  const existing = await prisma.infoSpotCategory.findFirst({
    where: { slug: "qa-notifications" },
    select: { id: true },
  });
  if (existing) return existing.id;
  const created = await prisma.infoSpotCategory.create({
    data: {
      name: `${QA_PREFIX} Categoría`,
      slug: "qa-notifications",
      description: "Categoría seed Etapa 20",
    },
  });
  return created.id;
}

async function upsertQaInfoSpotCall(input: {
  key: string;
  city: string;
  province: string;
  lat: number | null;
  lng: number | null;
  open: boolean;
  ended: boolean;
  actorUserId: number;
  categoryId: string;
}): Promise<{ eventId: string; callId: string; clfEventId: number | null }> {
  const slug = `qa-notif-${input.key}`;
  const title = `${QA_PREFIX} ${input.key}`;
  const startAt = input.ended
    ? new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
    : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  const endAt = input.ended
    ? new Date(Date.now() - 9 * 24 * 60 * 60 * 1000)
    : new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);

  let event = await prisma.infoSpotEvent.findUnique({ where: { slug } });
  if (!event) {
    event = await prisma.infoSpotEvent.create({
      data: {
        title,
        slug,
        description: `${QA_PREFIX} evento seed Etapa 20 (${input.key})`,
        summary: "Seed QA notificaciones",
        categoryId: input.categoryId,
        authorId: input.actorUserId,
        organizerName: QA_PREFIX,
        organizerEmail: qaEmail("organizer"),
        startAt,
        endAt,
        city: input.city,
        province: input.province,
        latitude: input.lat ?? undefined,
        longitude: input.lng ?? undefined,
        status: "PUBLISHED",
        venueName: `${QA_PREFIX} Venue`,
      },
    });
  } else {
    event = await prisma.infoSpotEvent.update({
      where: { id: event.id },
      data: {
        title,
        startAt,
        endAt,
        city: input.city,
        province: input.province,
        latitude: input.lat,
        longitude: input.lng,
      },
    });
  }

  let clfEventId: number | null = null;
  let publicUrl: string | null = null;
  if (input.open && input.lat != null && input.lng != null) {
    const existingCall = await prisma.infoSpotPhotographerCall.findUnique({
      where: { eventId: event.id },
    });
    if (existingCall?.clfEventId) {
      clfEventId = existingCall.clfEventId;
      await prisma.event.update({
        where: { id: clfEventId },
        data: {
          title,
          city: input.city,
          latitude: input.lat,
          longitude: input.lng,
          status: input.ended ? "CLOSED" : "ACTIVE",
          startsAt: startAt,
          endsAt: endAt,
        },
      }).catch(() => undefined);
    } else {
      const shareSlug = `qa-notif-${input.key}-${randomBytes(3).toString("hex")}`;
      const created = await prisma.event.create({
        data: {
          title,
          description: `${QA_PREFIX} CLF seed`,
          type: "OTHER",
          startsAt: startAt,
          endsAt: endAt,
          latitude: input.lat,
          longitude: input.lng,
          city: input.city,
          locationName: `${QA_PREFIX} Venue`,
          visibility: "PUBLIC",
          joinPolicy: "OPEN",
          status: input.ended ? "CLOSED" : "ACTIVE",
          creatorId: input.actorUserId,
          shareSlug,
          maxPhotographers: 10,
        },
      });
      clfEventId = created.id;
    }
    if (clfEventId) {
      const slug =
        (
          await prisma.event.findUnique({
            where: { id: clfEventId },
            select: { shareSlug: true },
          })
        )?.shareSlug || `qa-notif-${input.key}`;
      publicUrl = `${clfPublicBase()}/e/${slug}`;
    }
  }

  const call = await prisma.infoSpotPhotographerCall.upsert({
    where: { eventId: event.id },
    create: {
      eventId: event.id,
      enabled: true,
      visibility: "PUBLIC",
      joinPolicy: "OPEN",
      maxPhotographers: 10,
      clfEventType: "OTHER",
      desiredClfStatus: input.open && !input.ended ? "ACTIVE" : "CLOSED",
      provisioningStatus: clfEventId ? "PROVISIONED" : "BLOCKED",
      clfEventId,
      publicUrl,
      organizerEmail: qaEmail("organizer"),
      ownershipStatus: "RESOLVED",
      requestedByUserId: input.actorUserId,
      lastModifiedByUserId: input.actorUserId,
      provisionedAt: clfEventId ? new Date() : null,
    },
    update: {
      enabled: true,
      desiredClfStatus: input.open && !input.ended ? "ACTIVE" : "CLOSED",
      provisioningStatus: clfEventId ? "PROVISIONED" : "BLOCKED",
      clfEventId,
      publicUrl,
      lastModifiedByUserId: input.actorUserId,
    },
  });

  return { eventId: event.id, callId: call.id, clfEventId };
}

export async function seedNotificationsQa(): Promise<QaSeedManifest> {
  assertQaGate();
  const actorUserId = await resolveActorUserId();
  const categoryId = await ensureCategory();

  const near5 = offsetKm(ROSARIO, 5);
  const near20 = offsetKm(ROSARIO, 20);
  const near40 = offsetKm(ROSARIO, 40);
  const near80 = offsetKm(ROSARIO, 80);
  const far150 = offsetKm(ROSARIO, 150);

  const photographerUserIds: number[] = [];
  const specs = [
    { key: "ros-10", name: "Rosario <10km", lat: near5.lat, lng: near5.lng, city: "Rosario", province: "Santa Fe" },
    { key: "ros-25", name: "Rosario 10-25", lat: near20.lat, lng: near20.lng, city: "Rosario", province: "Santa Fe" },
    { key: "ros-50", name: "Rosario 25-50", lat: near40.lat, lng: near40.lng, city: "Rosario", province: "Santa Fe" },
    { key: "ros-100", name: "Rosario 50-100", lat: near80.lat, lng: near80.lng, city: "Rosario", province: "Santa Fe" },
    { key: "ros-far", name: "Fuera 100km", lat: far150.lat, lng: far150.lng, city: "Venado Tuerto", province: "Santa Fe" },
    { key: "sfe", name: "Santa Fe capital", lat: -31.6333, lng: -60.7, city: "Santa Fe", province: "Santa Fe" },
    { key: "caba", name: "CABA", lat: -34.6037, lng: -58.3816, city: "CABA", province: "CABA" },
    { key: "nocoords", name: "Sin coords", lat: null, lng: null, city: "Rosario", province: "Santa Fe" },
    { key: "inactive", name: "Inactivo", lat: near5.lat, lng: near5.lng, city: "Rosario", province: "Santa Fe", blocked: true },
    { key: "prefs-off", name: "Prefs off", lat: near5.lat, lng: near5.lng, city: "Rosario", province: "Santa Fe", nearby: false },
    { key: "inapp-only", name: "Solo IN_APP", lat: near5.lat, lng: near5.lng, city: "Rosario", province: "Santa Fe", channelEmail: false },
    { key: "inapp-email", name: "IN_APP+EMAIL", lat: near5.lat, lng: near5.lng, city: "Rosario", province: "Santa Fe", channelEmail: true },
    { key: "bad-email", name: "Email inválido", lat: near5.lat, lng: near5.lng, city: "Rosario", province: "Santa Fe", emailBroken: true, channelEmail: true },
    { key: "city-fallback", name: "Ciudad sin coords", lat: null, lng: null, city: "Rosario", province: "Santa Fe" },
  ] as const;

  for (const s of specs) {
    photographerUserIds.push(await upsertQaPhotographer(s));
  }

  const infoSpotEventIds: string[] = [];
  const photographerCallIds: string[] = [];
  const clfEventIds: number[] = [];

  const calls = [
    { key: "rosario-open", city: "Rosario", province: "Santa Fe", lat: ROSARIO.lat, lng: ROSARIO.lng, open: true, ended: false },
    { key: "santafe-open", city: "Santa Fe", province: "Santa Fe", lat: -31.6333, lng: -60.7, open: true, ended: false },
    { key: "caba-open", city: "CABA", province: "CABA", lat: -34.6037, lng: -58.3816, open: true, ended: false },
    { key: "rosario-nocoords", city: "Rosario", province: "Santa Fe", lat: null, lng: null, open: false, ended: false },
    { key: "rosario-closed", city: "Rosario", province: "Santa Fe", lat: ROSARIO.lat, lng: ROSARIO.lng, open: false, ended: false },
    { key: "rosario-ended", city: "Rosario", province: "Santa Fe", lat: ROSARIO.lat, lng: ROSARIO.lng, open: true, ended: true },
  ];

  for (const c of calls) {
    const row = await upsertQaInfoSpotCall({ ...c, actorUserId, categoryId });
    infoSpotEventIds.push(row.eventId);
    photographerCallIds.push(row.callId);
    if (row.clfEventId) clfEventIds.push(row.clfEventId);
  }

  // Fotógrafo ya postulado en rosario-open
  const openCall = await prisma.infoSpotPhotographerCall.findFirst({
    where: { event: { slug: "qa-notif-rosario-open" } },
    select: { clfEventId: true },
  });
  const appliedUserId = photographerUserIds[0];
  if (openCall?.clfEventId && appliedUserId) {
    await prisma.eventMember.upsert({
      where: {
        eventId_userId: { eventId: openCall.clfEventId, userId: appliedUserId },
      },
      create: {
        eventId: openCall.clfEventId,
        userId: appliedUserId,
        role: "PHOTOGRAPHER",
        status: "ACTIVE",
      },
      update: { status: "ACTIVE" },
    });
    await upsertQaPhotographer({
      key: "already-applied",
      name: "Ya postulado",
      lat: near5.lat,
      lng: near5.lng,
      city: "Rosario",
      province: "Santa Fe",
    }).then(async (id) => {
      photographerUserIds.push(id);
      await prisma.eventMember.upsert({
        where: { eventId_userId: { eventId: openCall.clfEventId!, userId: id } },
        create: {
          eventId: openCall.clfEventId!,
          userId: id,
          role: "PHOTOGRAPHER",
          status: "ACTIVE",
        },
        update: { status: "ACTIVE" },
      });
    });
  }

  const { seedQaBrowserRoles } = await import("./qa-browser-roles");
  await seedQaBrowserRoles();

  const rosario = await prisma.infoSpotEvent.findUnique({
    where: { slug: "qa-notif-rosario-open" },
    select: {
      id: true,
      slug: true,
      photographerCall: { select: { id: true, publicUrl: true, clfEventId: true } },
    },
  });
  const { mkdirSync, writeFileSync } = await import("node:fs");
  const { dirname, resolve } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const artifacts = resolve(dirname(fileURLToPath(import.meta.url)), "../../.qa-artifacts");
  mkdirSync(artifacts, { recursive: true });
  writeFileSync(
    resolve(artifacts, "notifications-qa-events.json"),
    JSON.stringify(
      {
        rosarioOpenEventId: rosario?.id ?? null,
        rosarioOpenSlug: rosario?.slug ?? null,
        rosarioCallId: rosario?.photographerCall?.id ?? null,
        rosarioPublicUrl: rosario?.photographerCall?.publicUrl ?? null,
        rosarioClfEventId: rosario?.photographerCall?.clfEventId ?? null,
      },
      null,
      2,
    ),
  );

  return {
    tag: QA_TAG,
    photographerUserIds: [...new Set(photographerUserIds)],
    infoSpotEventIds,
    photographerCallIds,
    clfEventIds,
    campaignIds: [],
    actorUserId,
  };
}

export async function cleanupNotificationsQa(options?: {
  dryRun?: boolean;
}): Promise<{
  dryRun: boolean;
  users: number;
  events: number;
  clfEvents: number;
  campaigns: number;
  deliveries: number;
  prefs: number;
}> {
  assertQaGate();
  const dryRun = options?.dryRun !== false;

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { tags: { has: QA_TAG } },
        { email: { endsWith: `@${QA_EMAIL_DOMAIN}` } },
        { name: { startsWith: QA_PREFIX } },
      ],
    },
    select: { id: true },
  });
  const userIds = users.map((u) => u.id);

  const events = await prisma.infoSpotEvent.findMany({
    where: {
      OR: [
        { title: { startsWith: QA_PREFIX } },
        { slug: { startsWith: "qa-notif-" } },
      ],
    },
    select: { id: true, photographerCall: { select: { id: true, clfEventId: true } } },
  });
  const clfEventIds = events
    .map((e) => e.photographerCall?.clfEventId)
    .filter((id): id is number => id != null);
  const extraClf = await prisma.event.findMany({
    where: { title: { startsWith: QA_PREFIX } },
    select: { id: true },
  });
  const allClfIds = [...new Set([...clfEventIds, ...extraClf.map((e) => e.id)])];

  const campaigns = await prisma.dnxNotificationCampaign.findMany({
    where: {
      OR: [
        { title: { contains: QA_PREFIX } },
        { sourceEntityId: { in: events.map((e) => e.photographerCall?.id).filter(Boolean) as string[] } },
        {
          filtersJson: {
            path: ["qaTag"],
            equals: QA_TAG,
          },
        },
      ],
    },
    select: { id: true },
  });

  const deliveries = campaigns.length
    ? await prisma.dnxNotificationDelivery.count({
        where: { campaignId: { in: campaigns.map((c) => c.id) } },
      })
    : 0;

  const report = {
    dryRun,
    users: userIds.length,
    events: events.length,
    clfEvents: allClfIds.length,
    campaigns: campaigns.length,
    deliveries,
    prefs: userIds.length,
  };

  if (dryRun) return report;

  if (campaigns.length) {
    await prisma.dnxNotificationAttribution.deleteMany({
      where: { campaignId: { in: campaigns.map((c) => c.id) } },
    });
    await prisma.dnxNotificationDelivery.deleteMany({
      where: { campaignId: { in: campaigns.map((c) => c.id) } },
    });
    await prisma.dnxNotificationCampaign.deleteMany({
      where: { id: { in: campaigns.map((c) => c.id) } },
    });
  }

  await prisma.dnxNotificationEventLog.deleteMany({
    where: {
      OR: [
        { sourceEntityId: { in: events.map((e) => e.photographerCall?.id).filter(Boolean) as string[] } },
        { idempotencyKey: { contains: "qa-notif" } },
      ],
    },
  });

  if (allClfIds.length) {
    // Tabla legacy puede no existir en todos los hosts staging.
    const hasNearbyTable = await prisma.$queryRawUnsafe<{ exists: boolean }[]>(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = 'EventNearbyPhotographerNotification'
       ) AS exists`,
    );
    if (hasNearbyTable[0]?.exists) {
      await prisma.eventNearbyPhotographerNotification.deleteMany({
        where: { eventId: { in: allClfIds } },
      });
    }
    await prisma.eventMember.deleteMany({ where: { eventId: { in: allClfIds } } });
    await prisma.event.deleteMany({ where: { id: { in: allClfIds } } });
  }

  for (const e of events) {
    await prisma.infoSpotPhotographerCall.deleteMany({ where: { eventId: e.id } });
    await prisma.infoSpotEvent.delete({ where: { id: e.id } }).catch(() => undefined);
  }

  if (userIds.length) {
    await prisma.dnxNotificationPreference.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.dashboardNotification.deleteMany({
      where: { userId: { in: userIds }, type: "DNX_NEARBY_PHOTOGRAPHER_CALL" },
    });
    await prisma.userSession.deleteMany({ where: { userId: { in: userIds } } }).catch(() => undefined);
    await prisma.infoSpotUserRole.deleteMany({ where: { userId: { in: userIds } } });
    // Join OPEN crea Album del fotógrafo — hay que borrar antes del User.
    const qaAlbums = await prisma.album.findMany({
      where: { userId: { in: userIds } },
      select: { id: true },
    });
    if (qaAlbums.length) {
      const albumIds = qaAlbums.map((a) => a.id);
      await prisma.photo.deleteMany({ where: { albumId: { in: albumIds } } }).catch(() => undefined);
      await prisma.album.deleteMany({ where: { id: { in: albumIds } } });
    }
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }

  await prisma.infoSpotCategory.deleteMany({ where: { slug: "qa-notifications" } }).catch(() => undefined);

  return report;
}

export function anonymizeDbUrl(url: string): string {
  return url.replace(/:\/\/([^:]+):[^@]+@/, "://$1:***@");
}
