/**
 * Etapa 13 — Smoke HTTP join/leave contra app CLF local + DB staging preview (ep-round-fog).
 *
 * Requiere:
 *   E13_CLF_DATABASE_URL  (DIRECT_URL round-fog)
 *   E13_CLF_PUBLIC_URL    (default http://127.0.0.1:3013)
 *
 * Uso:
 *   pnpm --filter @repo/db exec tsx ./scripts/e13-clf-http-smoke.ts
 *   pnpm --filter @repo/db exec tsx ./scripts/e13-clf-http-smoke.ts cleanup
 */
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import { PrismaClient } from "@prisma/client";
import { createClfEvent } from "../src/client";

const require = createRequire(
  new URL("../../../apps/compramelafoto/package.json", import.meta.url),
);
const bcrypt = require("bcryptjs") as typeof import("bcryptjs");

const MARKER = "[STAGING] Prueba integración Info Spot";
const SLUG_PREFIX = "e-e13http";
const EMAIL_DOMAIN = "e13.staging.dnxsuite.local";
const PASSWORD = "E13-Staging-Only!";

async function hashPassword(plain: string) {
  return bcrypt.hash(plain, 10);
}

function assertSafeUrl(url: string) {
  const cleaned = url.trim().replace(/^["']|["']$/g, "");
  const host = new URL(cleaned.replace(/^postgres(ql)?:/, "http:")).hostname;
  if (/falling-darkness/i.test(host)) {
    throw new Error("ABORT: DB parece producción (falling-darkness)");
  }
  if (!/round-fog/i.test(host)) {
    throw new Error(`ABORT: host inesperado E13: ${host}`);
  }
  return host.match(/^ep-[a-z0-9-]+/i)?.[0] || host;
}

async function cleanup(prisma: PrismaClient) {
  const events = await prisma.event.findMany({
    where: {
      OR: [{ title: { contains: MARKER } }, { shareSlug: { startsWith: "e-e13" } }],
    },
    select: { id: true },
  });
  const ids = events.map((e) => e.id);
  let members = 0;
  let albums = 0;
  if (ids.length) {
    members = (await prisma.eventMember.deleteMany({ where: { eventId: { in: ids } } })).count;
    await prisma.eventInvitation.deleteMany({ where: { eventId: { in: ids } } });
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
      /* ignore */
    }
    deletedUsers = (await prisma.user.deleteMany({ where: { id: { in: userIds } } })).count;
  }
  return { events: ids.length, members, albums, users: deletedUsers };
}

type Step = { name: string; ok: boolean; detail?: string };

function cookieJar(res: Response, jar: Map<string, string>) {
  const raw = res.headers.getSetCookie?.() || [];
  for (const c of raw) {
    const [pair] = c.split(";");
    const i = pair.indexOf("=");
    if (i > 0) jar.set(pair.slice(0, i), pair.slice(i + 1));
  }
  // Node < fetch getSetCookie fallback
  const single = res.headers.get("set-cookie");
  if (single && raw.length === 0) {
    for (const part of single.split(/,(?=[^;]+?=)/)) {
      const [pair] = part.trim().split(";");
      const i = pair.indexOf("=");
      if (i > 0) jar.set(pair.slice(0, i), pair.slice(i + 1));
    }
  }
}

function cookieHeader(jar: Map<string, string>) {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function main() {
  const dbUrlRaw =
    process.env.E13_CLF_DATABASE_URL || process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!dbUrlRaw) throw new Error("E13_CLF_DATABASE_URL required");
  const dbUrl = dbUrlRaw.trim().replace(/^["']|["']$/g, "");
  const host = assertSafeUrl(dbUrl);
  const origin = (process.env.E13_CLF_PUBLIC_URL || "http://127.0.0.1:3013").replace(/\/$/, "");
  if (/compramelafoto\.com$/i.test(new URL(origin).hostname)) {
    throw new Error("ABORT: no usar dominio productivo compramelafoto.com");
  }

  const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });
  const mode = process.argv.includes("cleanup") ? "cleanup" : "smoke";
  try {
    if (mode === "cleanup") {
      console.log(JSON.stringify({ ok: true, action: "cleanup", host, deleted: await cleanup(prisma) }, null, 2));
      return;
    }

    await cleanup(prisma);
    const steps: Step[] = [];
    const passwordHash = await hashPassword(PASSWORD);

    const organizer = await prisma.user.create({
      data: {
        email: `org@${EMAIL_DOMAIN}`,
        name: "E13 Org",
        role: "ORGANIZER",
        password: passwordHash,
        emailVerifiedAt: new Date(),
        isBlocked: false,
      },
    });
    const photo1 = await prisma.user.create({
      data: {
        email: `photo1@${EMAIL_DOMAIN}`,
        name: "E13 Photo1",
        role: "PHOTOGRAPHER",
        password: passwordHash,
        emailVerifiedAt: new Date(),
        isBlocked: false,
      },
    });
    const photo2 = await prisma.user.create({
      data: {
        email: `photo2@${EMAIL_DOMAIN}`,
        name: "E13 Photo2",
        role: "PHOTOGRAPHER",
        password: passwordHash,
        emailVerifiedAt: new Date(),
        isBlocked: false,
      },
    });

    const startsAt = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000);
    const created = await createClfEvent(prisma, {
      title: `${MARKER} HTTP OPEN`,
      description: "Smoke HTTP E13",
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
      creatorId: organizer.id,
    });
    const shareSlug = `${SLUG_PREFIX}-${randomBytes(4).toString("hex")}`;
    await prisma.event.update({ where: { id: created.id }, data: { shareSlug } });
    steps.push({ name: "seed", ok: true, detail: `slug=${shareSlug}` });

    const page = await fetch(`${origin}/e/${shareSlug}`, { redirect: "manual" });
    const pageHtml = await page.text();
    steps.push({
      name: "public_page",
      ok: page.status === 200 && /Plaza Staging E13|CABA|Términos staging E13|Inscrib/i.test(pageHtml),
      detail: `status=${page.status} len=${pageHtml.length}`,
    });

    const jar = new Map<string, string>();
    const loginRes = await fetch(`${origin}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: photo1.email, password: PASSWORD }),
      redirect: "manual",
    });
    cookieJar(loginRes, jar);
    const loginJson = await loginRes.json().catch(() => ({}));
    steps.push({
      name: "login",
      ok: loginRes.status === 200 && jar.size > 0,
      detail: `status=${loginRes.status} cookies=${jar.size > 0 ? "yes" : "no"}`,
    });

    const joinRes = await fetch(`${origin}/api/public/events/${shareSlug}/join`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: cookieHeader(jar),
      },
      body: JSON.stringify({ acceptTerms: true }),
    });
    const joinJson = await joinRes.json().catch(() => ({}));
    steps.push({
      name: "join_http",
      ok: joinRes.status === 200 && (joinJson.success === true || joinJson.outcome === "joined_active"),
      detail: `status=${joinRes.status} ${JSON.stringify(joinJson).slice(0, 220)}`,
    });

    const active = await prisma.eventMember.count({
      where: { eventId: created.id, role: "PHOTOGRAPHER", status: "ACTIVE" },
    });
    steps.push({ name: "member_active_db", ok: active === 1, detail: `active=${active}` });

    const join2 = await fetch(`${origin}/api/public/events/${shareSlug}/join`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: cookieHeader(jar),
      },
      body: JSON.stringify({ acceptTerms: true }),
    });
    const join2Json = await join2.json().catch(() => ({}));
    steps.push({
      name: "join_idempotent_http",
      ok:
        join2.status === 200 &&
        (join2Json.outcome === "already_active" || join2Json.alreadyMember === true),
      detail: String(join2Json.outcome || join2Json.message || join2.status),
    });

    // second photographer jar
    const jar2 = new Map<string, string>();
    const login2 = await fetch(`${origin}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: photo2.email, password: PASSWORD }),
    });
    cookieJar(login2, jar2);
    const full = await fetch(`${origin}/api/public/events/${shareSlug}/join`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: cookieHeader(jar2),
      },
      body: JSON.stringify({ acceptTerms: true }),
    });
    const fullJson = await full.json().catch(() => ({}));
    steps.push({
      name: "cupo_http_reject",
      ok: full.status === 400,
      detail: `status=${full.status} ${JSON.stringify(fullJson).slice(0, 220)}`,
    });

    const leave = await fetch(`${origin}/api/public/events/${shareSlug}/leave`, {
      method: "DELETE",
      headers: { cookie: cookieHeader(jar) },
    });
    const leaveJson = await leave.json().catch(() => ({}));
    const afterLeave = await prisma.eventMember.count({
      where: { eventId: created.id, role: "PHOTOGRAPHER", status: "ACTIVE" },
    });
    steps.push({
      name: "leave_http",
      ok: leave.status === 200 && afterLeave === 0,
      detail: `status=${leave.status} active=${afterLeave} ${JSON.stringify(leaveJson).slice(0, 160)}`,
    });

    const failed = steps.filter((s) => !s.ok);
    console.log(
      JSON.stringify(
        {
          ok: failed.length === 0,
          action: "clf-http-smoke",
          host,
          origin,
          shareSlug,
          passed: steps.filter((s) => s.ok).length,
          failed: failed.map((f) => f.name),
          steps,
        },
        null,
        2,
      ),
    );

    const deleted = await cleanup(prisma);
    console.log(JSON.stringify({ action: "cleanup_after", deleted }, null, 2));
    if (failed.length) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
