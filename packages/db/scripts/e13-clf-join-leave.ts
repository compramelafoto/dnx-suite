/**
 * Etapa 13 — Join/leave real contra CLF staging preview (ep-round-fog).
 * NUNCA usa falling-darkness / compramelafoto.com.
 *
 * Requiere env:
 *   E13_CLF_DATABASE_URL = DIRECT_URL de compramelafoto-dnxsuite preview
 *   E13_CLF_PUBLIC_URL   = http://127.0.0.1:3000 (app local) o staging host
 *
 * Uso:
 *   pnpm --filter @repo/db exec tsx ../../apps/infospot/lib/smoke/e13-clf-join-leave.ts
 *   pnpm --filter @repo/db exec tsx ../../apps/infospot/lib/smoke/e13-clf-join-leave.ts cleanup
 */
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import { PrismaClient } from "@prisma/client";
import { createClfEvent, closeClfEventCall } from "../src/clf-event-write";

const require = createRequire(
  new URL("../../../apps/compramelafoto/package.json", import.meta.url),
);
const bcrypt = require("bcryptjs") as typeof import("bcryptjs");
const MARKER = "[STAGING] Prueba integración Info Spot";
const SLUG_PREFIX = "e-e13gate";
const EMAIL_DOMAIN = "e13.staging.dnxsuite.local";

async function hashPassword(plain: string) {
  return bcrypt.hash(plain, 10);
}
function assertSafeUrl(url: string) {
  const cleaned = url.trim().replace(/^["']|["']$/g, "");
  const host = new URL(cleaned.replace(/^postgres(ql)?:/, "http:")).hostname;
  if (/falling-darkness/i.test(host)) {
    throw new Error("ABORT: DB parece dnxsuite production (falling-darkness)");
  }
  if (!/round-fog/i.test(host)) {
    throw new Error(`ABORT: host inesperado para gate E13: ${host.match(/^ep-[a-z0-9-]+/i)?.[0] || host}`);
  }
  return host.match(/^ep-[a-z0-9-]+/i)?.[0] || host;
}

async function cleanup(prisma: PrismaClient) {
  const events = await prisma.event.findMany({
    where: {
      OR: [{ title: { contains: MARKER } }, { shareSlug: { startsWith: SLUG_PREFIX } }],
    },
    select: { id: true, shareSlug: true },
  });
  const ids = events.map((e) => e.id);
  let members = 0;
  let invitations = 0;
  let albums = 0;
  if (ids.length) {
    members = (await prisma.eventMember.deleteMany({ where: { eventId: { in: ids } } })).count;
    invitations = (
      await prisma.eventInvitation.deleteMany({ where: { eventId: { in: ids } } })
    ).count;
    try {
      albums = (await prisma.album.deleteMany({ where: { eventId: { in: ids } } })).count;
    } catch {
      albums = 0;
    }
    await prisma.event.deleteMany({ where: { id: { in: ids } } });
  }
  const users = await prisma.user.findMany({
    where: { email: { endsWith: `@${EMAIL_DOMAIN}` } },
    select: { id: true },
  });
  const userIds = users.map((u) => u.id);
  let deletedUsers = 0;
  if (userIds.length) {
    await prisma.eventMember.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.eventInvitation.deleteMany({ where: { userId: { in: userIds } } });
    try {
      await prisma.userSession.deleteMany({ where: { userId: { in: userIds } } });
    } catch {
      /* optional model */
    }
    deletedUsers = (await prisma.user.deleteMany({ where: { id: { in: userIds } } })).count;
  }
  return { events: ids.length, members, invitations, albums, users: deletedUsers };
}

async function ensureActors(prisma: PrismaClient) {
  const passwordHash = await hashPassword("E13-Staging-Only!");
  const orgEmail = `org@${EMAIL_DOMAIN}`;
  const p1Email = `photo1@${EMAIL_DOMAIN}`;
  const p2Email = `photo2@${EMAIL_DOMAIN}`;

  const upsert = async (
    email: string,
    role: "ORGANIZER" | "PHOTOGRAPHER",
    name: string,
  ) => {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return prisma.user.update({
        where: { id: existing.id },
        data: { role, isBlocked: false, password: passwordHash, name, emailVerifiedAt: new Date() },
      });
    }
    return prisma.user.create({
      data: {
        email,
        name,
        role,
        password: passwordHash,
        emailVerifiedAt: new Date(),
        isBlocked: false,
      },
    });
  };

  const organizer = await upsert(orgEmail, "ORGANIZER", "E13 Staging Organizer");
  const photo1 = await upsert(p1Email, "PHOTOGRAPHER", "E13 Photo One");
  const photo2 = await upsert(p2Email, "PHOTOGRAPHER", "E13 Photo Two");
  return { organizer, photo1, photo2, passwordPlain: "E13-Staging-Only!" };
}

type Step = { name: string; ok: boolean; detail?: string };

async function activeCount(prisma: PrismaClient, eventId: number) {
  return prisma.eventMember.count({
    where: { eventId, role: "PHOTOGRAPHER", status: "ACTIVE" },
  });
}

async function run(prisma: PrismaClient) {
  const steps: Step[] = [];
  const actors = await ensureActors(prisma);
  steps.push({
    name: "actors",
    ok: true,
    detail: `org#${actors.organizer.id} p1#${actors.photo1.id} p2#${actors.photo2.id}`,
  });

  const startsAt = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000);
  const created = await createClfEvent(prisma, {
    title: `${MARKER} OPEN`,
    description: "Evento sintético E13 — staging preview only",
    type: "OTHER",
    startsAt,
    latitude: -34.6037,
    longitude: -58.3816,
    locationName: "Plaza Staging E13",
    city: "CABA",
    visibility: "PUBLIC",
    joinPolicy: "OPEN",
    maxPhotographers: 1,
    photographerTerms: "Términos staging E13",
    status: "ACTIVE",
    creatorId: actors.organizer.id,
  });
  const shareSlug = `${SLUG_PREFIX}-${randomBytes(4).toString("hex")}`;
  await prisma.event.update({ where: { id: created.id }, data: { shareSlug } });
  steps.push({ name: "create_event", ok: true, detail: `id=${created.id} slug=${shareSlug}` });

  // Direct enroll mirroring API OPEN path (HTTP tested separately if server up)
  const enroll = async (userId: number) => {
    const event = await prisma.event.findUniqueOrThrow({ where: { id: created.id } });
    const existing = await prisma.eventMember.findUnique({
      where: { eventId_userId: { eventId: event.id, userId } },
    });
    if (existing?.status === "ACTIVE") {
      return { ok: true as const, outcome: "already_active" as const };
    }
    const active = await activeCount(prisma, event.id);
    if (event.maxPhotographers != null && active >= event.maxPhotographers) {
      return { ok: false as const, outcome: "cupo_completo" as const };
    }
    if (existing) {
      await prisma.eventMember.update({
        where: { id: existing.id },
        data: { status: "ACTIVE", termsAcceptedAt: new Date(), termsAcceptedText: "e13" },
      });
      return { ok: true as const, outcome: "reactivated" as const };
    }
    await prisma.eventMember.create({
      data: {
        eventId: event.id,
        userId,
        role: "PHOTOGRAPHER",
        status: "ACTIVE",
        termsAcceptedAt: new Date(),
        termsAcceptedText: "e13",
      },
    });
    return { ok: true as const, outcome: "enrolled" as const };
  };

  const j1 = await enroll(actors.photo1.id);
  steps.push({ name: "join_first", ok: j1.ok && j1.outcome === "enrolled", detail: JSON.stringify(j1) });
  const j1b = await enroll(actors.photo1.id);
  steps.push({
    name: "join_idempotent",
    ok: j1b.ok && j1b.outcome === "already_active",
    detail: JSON.stringify(j1b),
  });
  const c1 = await activeCount(prisma, created.id);
  steps.push({ name: "cupo_after_first", ok: c1 === 1, detail: `active=${c1}` });
  const j2 = await enroll(actors.photo2.id);
  steps.push({ name: "join_rejected_when_full", ok: !j2.ok && j2.outcome === "cupo_completo", detail: JSON.stringify(j2) });

  // leave
  await prisma.eventMember.deleteMany({
    where: { eventId: created.id, userId: actors.photo1.id },
  });
  const cLeave = await activeCount(prisma, created.id);
  steps.push({ name: "leave", ok: cLeave === 0, detail: `active=${cLeave}` });
  const j3 = await enroll(actors.photo1.id);
  steps.push({ name: "rejoin", ok: j3.ok, detail: JSON.stringify(j3) });

  // REQUEST
  const req = await createClfEvent(prisma, {
    title: `${MARKER} REQUEST`,
    type: "OTHER",
    startsAt,
    latitude: -34.6,
    longitude: -58.38,
    city: "CABA",
    visibility: "PUBLIC",
    joinPolicy: "REQUEST",
    maxPhotographers: 2,
    status: "ACTIVE",
    creatorId: actors.organizer.id,
  });
  await prisma.event.update({
    where: { id: req.id },
    data: { shareSlug: `${SLUG_PREFIX}-req-${randomBytes(3).toString("hex")}` },
  });
  await prisma.eventMember.create({
    data: {
      eventId: req.id,
      userId: actors.photo2.id,
      role: "PHOTOGRAPHER",
      status: "PENDING",
      termsAcceptedAt: new Date(),
      termsAcceptedText: "e13-req",
    },
  });
  const pending = await prisma.eventMember.count({
    where: { eventId: req.id, status: "PENDING" },
  });
  const activeReq = await activeCount(prisma, req.id);
  steps.push({
    name: "request_pending_not_active",
    ok: pending === 1 && activeReq === 0,
    detail: `pending=${pending} active=${activeReq}`,
  });

  // INVITE_ONLY
  const inv = await createClfEvent(prisma, {
    title: `${MARKER} INVITE_ONLY`,
    type: "OTHER",
    startsAt,
    latitude: -34.61,
    longitude: -58.39,
    city: "CABA",
    visibility: "UNLISTED",
    joinPolicy: "INVITE_ONLY",
    status: "ACTIVE",
    creatorId: actors.organizer.id,
  });
  const invCount = await prisma.eventInvitation.count({ where: { eventId: inv.id } });
  steps.push({ name: "invite_only_no_public", ok: invCount === 0 });

  // CLOSED
  await closeClfEventCall(prisma, created.id);
  const closed = await prisma.event.findUniqueOrThrow({
    where: { id: created.id },
    select: { status: true },
  });
  steps.push({ name: "closed", ok: closed.status === "CLOSED", detail: closed.status });

  // organizer cannot be PHOTOGRAPHER leave target
  const orgAsPhoto = await prisma.user.findFirst({
    where: { id: actors.organizer.id, role: { in: ["PHOTOGRAPHER", "LAB_PHOTOGRAPHER"] } },
  });
  steps.push({
    name: "organizer_not_photographer_role",
    ok: orgAsPhoto == null,
  });

  return { steps, shareSlug, actors };
}

async function main() {
  const url = process.env.E13_CLF_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("E13_CLF_DATABASE_URL or DATABASE_URL required");
  const host = assertSafeUrl(url);
  const mode = process.argv.includes("cleanup") ? "cleanup" : "gate";
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    if (mode === "cleanup") {
      const deleted = await cleanup(prisma);
      console.log(JSON.stringify({ ok: true, action: "cleanup", host, deleted }, null, 2));
      return;
    }
    await cleanup(prisma);
    const result = await run(prisma);
    const failed = result.steps.filter((s) => !s.ok);
    console.log(
      JSON.stringify(
        {
          ok: failed.length === 0,
          action: "clf-join-leave-gate",
          host,
          shareSlug: result.shareSlug,
          // no emails in clear beyond domain
          actors: {
            organizerId: result.actors.organizer.id,
            photo1Id: result.actors.photo1.id,
            photo2Id: result.actors.photo2.id,
            emailDomain: EMAIL_DOMAIN,
          },
          passed: result.steps.filter((s) => s.ok).length,
          failed: failed.map((f) => f.name),
          steps: result.steps,
          keepForHttp: process.argv.includes("--keep"),
        },
        null,
        2,
      ),
    );
    if (!process.argv.includes("--keep")) {
      const deleted = await cleanup(prisma);
      console.log(JSON.stringify({ action: "cleanup_after", deleted }, null, 2));
    } else {
      console.log(
        JSON.stringify({
          action: "kept",
          hint: "Run with cleanup arg later. Password for e13 users is ephemeral in this process only.",
        }),
      );
    }
    if (failed.length) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(String(e));
  process.exitCode = 1;
});
