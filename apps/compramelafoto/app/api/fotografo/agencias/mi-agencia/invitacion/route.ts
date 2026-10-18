import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwnedAgency } from "@/lib/agencies/owner-auth";
import { appBaseUrl, buildInviteUrl, createInviteToken } from "@/lib/agencies/invite-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Genera un link nuevo; el anterior deja de funcionar. */
export async function POST() {
  const a = await requireOwnedAgency();
  if ("res" in a) return a.res;
  const { token, tokenHash } = createInviteToken();
  await prisma.$transaction([
    prisma.agencyInvite.updateMany({ where: { agencyId: a.agency.id, revokedAt: null }, data: { revokedAt: new Date() } }),
    prisma.agencyInvite.create({ data: { agencyId: a.agency.id, tokenHash, createdByUserId: a.user.id } }),
  ]);
  return NextResponse.json({ url: buildInviteUrl(appBaseUrl(), token) });
}
