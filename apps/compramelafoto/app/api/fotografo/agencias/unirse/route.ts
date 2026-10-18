import { NextRequest, NextResponse } from "next/server";
import { prisma, Role } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { hashToken } from "@/lib/token-hash";
import { bpsToPercentLabel, planJoin, resolveAgencyTerms } from "@/lib/agencies/rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INVALID_LINK = "Este link de invitación ya no funciona. Pedile uno nuevo a la agencia.";

async function findValidInvite(token: string) {
  if (!token) return null;
  const invite = await prisma.agencyInvite.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true, revokedAt: true,
      agency: { select: { id: true, ownerUserId: true, name: true, logoUrl: true, description: true, defaultCommissionBps: true, termsText: true, termsVersion: true } },
    },
  });
  return invite && !invite.revokedAt ? invite : null;
}

async function auth() {
  const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
  if (error || !user) return { res: NextResponse.json({ error: error || "No autorizado" }, { status: 401 }) } as const;
  return { user } as const;
}

export async function GET(req: NextRequest) {
  const a = await auth();
  if ("res" in a) return a.res;
  const invite = await findValidInvite(req.nextUrl.searchParams.get("token") ?? "");
  if (!invite) return NextResponse.json({ error: INVALID_LINK }, { status: 404 });
  const ag = invite.agency;
  const member = await prisma.agencyMember.findUnique({
    where: { agencyId_userId: { agencyId: ag.id, userId: a.user.id } },
    select: { status: true },
  });
  return NextResponse.json({
    agency: {
      name: ag.name,
      logoUrl: ag.logoUrl,
      description: ag.description,
      commissionLabel: bpsToPercentLabel(ag.defaultCommissionBps),
      terms: resolveAgencyTerms(ag),
    },
    alreadyActive: member?.status === "ACTIVE",
    isOwner: ag.ownerUserId === a.user.id,
  });
}

export async function POST(req: NextRequest) {
  const a = await auth();
  if ("res" in a) return a.res;
  const body = (await req.json().catch(() => ({}))) as { token?: unknown; acceptTerms?: unknown };
  const invite = await findValidInvite(typeof body.token === "string" ? body.token : "");
  if (!invite) return NextResponse.json({ error: INVALID_LINK }, { status: 404 });
  const ag = invite.agency;
  if (ag.ownerUserId === a.user.id) {
    return NextResponse.json({ error: "Sos el dueño de esta agencia: no hace falta que te sumes." }, { status: 409 });
  }
  if (body.acceptTerms !== true) {
    return NextResponse.json({ error: "Para sumarte tenés que aceptar las condiciones de la agencia." }, { status: 400 });
  }
  const existing = await prisma.agencyMember.findUnique({
    where: { agencyId_userId: { agencyId: ag.id, userId: a.user.id } },
    select: { id: true, status: true },
  });
  const plan = planJoin(existing);
  if (plan.action === "already_active") return NextResponse.json({ outcome: "already_active" });

  const now = new Date();
  const terms = {
    termsVersionAccepted: ag.termsVersion,
    termsAcceptedAt: now,
    termsAcceptedText: resolveAgencyTerms(ag),
    requestMessage: null,
  };

  try {
    if (plan.action === "request_again") {
      // Dado de baja vuelve a solicitar
      await prisma.$transaction([
        prisma.agencyMember.update({
          where: { id: existing!.id },
          data: { status: "REQUESTED", ...terms },
        }),
        prisma.agencyInvite.update({ where: { id: invite.id }, data: { useCount: { increment: 1 } } }),
      ]);
      return NextResponse.json({ outcome: "requested" });
    } else {
      // create o reactivate
      const joinTerms = {
        status: "ACTIVE",
        joinedAt: now,
        removedAt: null,
        ...terms,
      };
      await prisma.$transaction([
        plan.action === "create"
          ? prisma.agencyMember.create({ data: { agencyId: ag.id, userId: a.user.id, ...joinTerms } })
          : prisma.agencyMember.update({ where: { id: existing!.id }, data: joinTerms }),
        prisma.agencyInvite.update({ where: { id: invite.id }, data: { useCount: { increment: 1 } } }),
      ]);
      return NextResponse.json({ outcome: "joined" });
    }
  } catch (err) {
    // Manejo de race condition: P2002 es unique constraint violation
    if (err instanceof Error && "code" in err && err.code === "P2002") {
      return NextResponse.json({ outcome: "already_active" });
    }
    throw err;
  }
}
