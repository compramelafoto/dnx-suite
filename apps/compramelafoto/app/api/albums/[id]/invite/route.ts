import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { randomBytes } from "crypto";
import { hashToken } from "@/lib/token-hash";
import { sendEmail } from "@/emails/send";
import { buildAlbumInviteEmail } from "@/emails/templates/auth";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function resolveAppUrl(): string {
  const raw =
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "";
  if (!raw) return "http://localhost:3000";
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  return `https://${raw}`;
}

function normalizeEmails(input: unknown): string[] {
  const values = Array.isArray(input) ? input : [input];
  return values
    .flatMap((v) => String(v || "").split(/[\s,;]+/))
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function assertAlbumOwnerOrAdmin(albumId: number, userId: number, role: Role) {
  const album = await prisma.album.findUnique({
    where: { id: albumId },
    select: { id: true, userId: true, title: true, publicSlug: true, isPublic: true },
  });
  if (!album) {
    return { ok: false as const, error: "Álbum no encontrado" };
  }
  if (role !== Role.ADMIN && album.userId !== userId) {
    return { ok: false as const, error: "No autorizado para invitar en este álbum" };
  }
  return { ok: true as const, album };
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER, Role.ADMIN]);
  if (error || !user) {
    return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
  }

  const { id } = await Promise.resolve(params);
  const albumId = Number(id);
  if (!Number.isFinite(albumId)) {
    return NextResponse.json({ error: "id inválido" }, { status: 400 });
  }

  const albumCheck = await assertAlbumOwnerOrAdmin(albumId, user.id, user.role);
  if (!albumCheck.ok) {
    return NextResponse.json({ error: albumCheck.error }, { status: 403 });
  }

  const [accesses, invitations] = await Promise.all([
    prisma.albumAccess.findMany({
      where: { albumId },
      include: { user: { select: { id: true, email: true, emailVerifiedAt: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.albumInvitation.findMany({
      where: { albumId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
      select: {
        invitedEmail: true,
        status: true,
        expiresAt: true,
        acceptedAt: true,
      },
    }),
  ]);

  const accessRows = accesses.map((a) => ({
    email: a.user.email,
    status: a.user.emailVerifiedAt ? "ACTIVE" : "PENDING_EMAIL",
  }));

  const inviteRows = invitations.map((i) => ({
    email: i.invitedEmail,
    status: i.status,
    expiresAt: i.expiresAt?.toISOString?.() ?? null,
    acceptedAt: i.acceptedAt?.toISOString?.() ?? null,
  }));

  return NextResponse.json(
    { accesses: accessRows, invitations: inviteRows, album: albumCheck.album },
    { status: 200 }
  );
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER, Role.ADMIN]);
  if (error || !user) {
    return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
  }

  const { id } = await Promise.resolve(params);
  const albumId = Number(id);
  if (!Number.isFinite(albumId)) {
    return NextResponse.json({ error: "id inválido" }, { status: 400 });
  }

  const albumCheck = await assertAlbumOwnerOrAdmin(albumId, user.id, user.role);
  if (!albumCheck.ok) {
    return NextResponse.json({ error: albumCheck.error }, { status: 403 });
  }

  const rateKey = `invite:${user.id}:${albumId}`;
  const rate = checkRateLimit({ key: rateKey, limit: 20, windowMs: 60 * 1000 });
  if (!rate.allowed) {
    return NextResponse.json({ error: "Demasiadas invitaciones. Intentá de nuevo en un minuto." }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const emails = normalizeEmails(body.emails ?? body.email);
  const uniqueEmails = Array.from(new Set(emails));

  if (!uniqueEmails.length) {
    return NextResponse.json({ error: "Emails requeridos" }, { status: 400 });
  }

  const validEmails = uniqueEmails.filter(isValidEmail);
  const invalidEmails = uniqueEmails.filter((e) => !isValidEmail(e));

  const users = await prisma.user.findMany({
    where: { email: { in: validEmails } },
    select: { id: true, email: true, name: true, emailVerifiedAt: true },
  });
  const userByEmail = new Map(users.map((u) => [u.email.toLowerCase(), u]));

  const accessRows = users.length
    ? await prisma.albumAccess.findMany({
        where: { albumId, userId: { in: users.map((u) => u.id) } },
        select: { userId: true },
      })
    : [];
  const accessByUserId = new Set(accessRows.map((a) => a.userId));

  const results: Array<{ email: string; status: string }> = [];

  for (const email of validEmails) {
    const existingUser = userByEmail.get(email);
    const alreadyHasAccess = existingUser ? accessByUserId.has(existingUser.id) : false;
    if (alreadyHasAccess || (existingUser && existingUser.id === albumCheck.album.userId)) {
      results.push({ email, status: "already_has_access" });
      continue;
    }

    const inviteToken = randomBytes(32).toString("hex");
    const tokenHash = hashToken(inviteToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await prisma.albumInvitation.updateMany({
      where: { albumId, invitedEmail: email, status: "PENDING" },
      data: { status: "EXPIRED" },
    });

    if (existingUser?.emailVerifiedAt) {
      await prisma.albumAccess.upsert({
        where: { albumId_userId: { albumId, userId: existingUser.id } },
        update: {},
        create: { albumId, userId: existingUser.id, role: "VIEWER" },
      });
      await prisma.albumInvitation.create({
        data: {
          albumId,
          invitedEmail: email,
          invitedByUserId: user.id,
          tokenHash,
          status: "ACCEPTED",
          expiresAt,
          acceptedAt: new Date(),
          acceptedByUserId: existingUser.id,
        },
      });
    } else {
      await prisma.albumInvitation.create({
        data: {
          albumId,
          invitedEmail: email,
          invitedByUserId: user.id,
          tokenHash,
          status: "PENDING",
          expiresAt,
        },
      });
    }

    const inviteUrl = `${resolveAppUrl()}/invite/${inviteToken}`;
    try {
      const { subject, html } = buildAlbumInviteEmail({
        albumTitle: albumCheck.album.title,
        inviteUrl,
        invitedByName: user.name || "ComprameLaFoto",
      });
      await sendEmail({
        to: email,
        subject,
        html,
        templateKey: "ALBUM_INVITE",
        meta: { albumId, userId: user.id },
      });
    } catch (emailErr) {
      console.error("Error enviando invitación:", emailErr);
    }

    results.push({ email, status: "invited" });
  }

  invalidEmails.forEach((email) => results.push({ email, status: "invalid_email" }));

  return NextResponse.json({ results }, { status: 200 });
}
