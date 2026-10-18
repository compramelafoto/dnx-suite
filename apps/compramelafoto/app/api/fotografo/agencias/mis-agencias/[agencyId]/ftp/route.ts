import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { issueAgencyFtpCredential, revokeAgencyFtpCredentials } from "@/lib/agencies/ftp-credentials";
import {
  getCameraConnectionFtpHost,
  getCameraConnectionFtpPort,
  isCameraConnectionFtpServerLive,
} from "@/lib/camera-connection/camera-connection-api-helpers";
import { requireActiveAgencyMember } from "../membership";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ agencyId: string }> };

async function readAlbumId(req: NextRequest, agencyId: number): Promise<{ albumId: number } | { res: NextResponse }> {
  const body = (await req.json().catch(() => ({}))) as { albumId?: unknown };
  const albumId = Number(body.albumId);
  const own =
    Number.isInteger(albumId) && albumId > 0
      ? await prisma.agencyAlbum.findFirst({ where: { agencyId, albumId }, select: { albumId: true } })
      : null;
  if (!own) return { res: NextResponse.json({ error: "Ese álbum no es de la agencia." }, { status: 400 }) };
  return { albumId };
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const m = await requireActiveAgencyMember(params);
  if ("res" in m) return m.res;
  const cred = await prisma.agencyUploadCredential.findFirst({
    where: { memberId: m.memberId, revokedAt: null },
    select: { ftpUsername: true, albumId: true, lastUsedAt: true, album: { select: { title: true } } },
  });
  return NextResponse.json({
    live: isCameraConnectionFtpServerLive(),
    host: getCameraConnectionFtpHost(),
    port: getCameraConnectionFtpPort(),
    credential: cred
      ? { ftpUsername: cred.ftpUsername, albumId: cred.albumId, albumTitle: cred.album.title, lastUsedAt: cred.lastUsedAt ? cred.lastUsedAt.toISOString() : null }
      : null,
  });
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const m = await requireActiveAgencyMember(params);
  if ("res" in m) return m.res;
  const a = await readAlbumId(req, m.agencyId);
  if ("res" in a) return a.res;
  const { ftpUsername, password } = await issueAgencyFtpCredential({ agencyId: m.agencyId, memberId: m.memberId, albumId: a.albumId });
  return NextResponse.json({ ftpUsername, password, host: getCameraConnectionFtpHost(), port: getCameraConnectionFtpPort() });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const m = await requireActiveAgencyMember(params);
  if ("res" in m) return m.res;
  const a = await readAlbumId(req, m.agencyId);
  if ("res" in a) return a.res;
  const res = await prisma.agencyUploadCredential.updateMany({
    where: { memberId: m.memberId, revokedAt: null },
    data: { albumId: a.albumId },
  });
  if (res.count === 0) return NextResponse.json({ error: "Todavía no sacaste un usuario de FTP." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const m = await requireActiveAgencyMember(params);
  if ("res" in m) return m.res;
  await revokeAgencyFtpCredentials(m.memberId);
  return NextResponse.json({ ok: true });
}
