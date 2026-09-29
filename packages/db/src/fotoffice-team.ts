/**
 * Equipo del workspace: invitaciones, cambios de rol, bajas y bitácora administrativa.
 * Las reglas de quién puede hacer qué NO viven acá: las valida la action con
 * `validarAccionSobreMiembro`. Esta capa sólo persiste, siempre de forma transaccional.
 */
import type { WorkspaceRole } from "@prisma/client";
import { prisma } from "./client";

export class TeamError extends Error {
  constructor(readonly reason: "ALREADY_MEMBER" | "INVITATION_INVALID" | "NOT_FOUND") {
    super(reason);
  }
}

export async function recordAdminEvent(e: {
  workspaceId: string;
  actorUserId: number | null;
  kind: string;
  targetUserId?: number;
  targetEmail?: string;
  fromRole?: string;
  toRole?: string;
  moduleKey?: string;
  detail?: string;
}): Promise<void> {
  await prisma.workspaceAdminEvent.create({ data: e });
}

export async function createTeamInvitation(input: {
  workspaceId: string;
  email: string;
  role: WorkspaceRole;
  tokenHash: string;
  expiresAt: Date;
  invitedByUserId: number;
}): Promise<{ id: string; resend: boolean }> {
  const email = input.email.trim().toLowerCase();
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true },
    });
    if (user) {
      const yaEsta = await tx.workspaceMembership.findUnique({
        where: { userId_workspaceId: { userId: user.id, workspaceId: input.workspaceId } },
        select: { id: true },
      });
      if (yaEsta) throw new TeamError("ALREADY_MEMBER");
    }
    const superseded = await tx.workspaceInvitation.updateMany({
      where: { workspaceId: input.workspaceId, email, acceptedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    const inv = await tx.workspaceInvitation.create({
      data: {
        workspaceId: input.workspaceId,
        email,
        role: input.role,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
        invitedByUserId: input.invitedByUserId,
      },
      select: { id: true },
    });
    await tx.workspaceAdminEvent.create({
      data: {
        workspaceId: input.workspaceId,
        actorUserId: input.invitedByUserId,
        kind: "INVITED",
        targetEmail: email,
        toRole: input.role,
      },
    });
    return { id: inv.id, resend: superseded.count > 0 };
  });
}

export async function markTeamInvitationDelivery(id: string, sent: boolean): Promise<void> {
  await prisma.workspaceInvitation.update({
    where: { id },
    data: sent ? { sentAt: new Date(), sendFailedAt: null } : { sendFailedAt: new Date() },
  });
}

export async function revokeTeamInvitation(workspaceId: string, id: string, actorUserId: number): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const inv = await tx.workspaceInvitation.findFirst({
      where: { id, workspaceId, acceptedAt: null },
      select: { email: true, role: true },
    });
    if (!inv) throw new TeamError("NOT_FOUND");
    await tx.workspaceInvitation.updateMany({
      where: { id, workspaceId, acceptedAt: null },
      data: { revokedAt: new Date() },
    });
    await tx.workspaceAdminEvent.create({
      data: { workspaceId, actorUserId, kind: "INVITE_REVOKED", targetEmail: inv.email, toRole: inv.role },
    });
  });
}

/** El token es lo que determina el workspace: acá no hay `workspaceId` de entrada por diseño. */
export function findTeamInvitationByTokenHash(tokenHash: string) {
  return prisma.workspaceInvitation.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      workspaceId: true,
      email: true,
      role: true,
      expiresAt: true,
      acceptedAt: true,
      revokedAt: true,
      workspace: { select: { name: true } },
    },
  });
}

export async function acceptTeamInvitation(id: string, userId: number): Promise<{ workspaceId: string }> {
  return prisma.$transaction(async (tx) => {
    const now = new Date();
    const claimed = await tx.workspaceInvitation.updateMany({
      where: { id, acceptedAt: null, revokedAt: null, expiresAt: { gt: now } },
      data: { acceptedAt: now, acceptedByUserId: userId },
    });
    if (claimed.count !== 1) throw new TeamError("INVITATION_INVALID");
    const inv = await tx.workspaceInvitation.findUniqueOrThrow({
      where: { id },
      select: { workspaceId: true, role: true, email: true },
    });
    await tx.workspaceMembership.upsert({
      where: { userId_workspaceId: { userId, workspaceId: inv.workspaceId } },
      update: {},
      create: { userId, workspaceId: inv.workspaceId, role: inv.role },
    });
    await tx.workspaceAppAccess.upsert({
      where: { userId_workspaceId_app: { userId, workspaceId: inv.workspaceId, app: "FOTOFFICE" } },
      update: { enabled: true },
      create: { userId, workspaceId: inv.workspaceId, app: "FOTOFFICE", enabled: true },
    });
    await tx.user.updateMany({ where: { id: userId, emailVerifiedAt: null }, data: { emailVerifiedAt: now } });
    await tx.workspaceAdminEvent.create({
      data: {
        workspaceId: inv.workspaceId,
        actorUserId: userId,
        kind: "ACCEPTED",
        targetUserId: userId,
        targetEmail: inv.email,
        toRole: inv.role,
      },
    });
    return { workspaceId: inv.workspaceId };
  });
}

export async function listTeam(workspaceId: string) {
  const desde = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
  const [memberships, invitations, events] = await Promise.all([
    prisma.workspaceMembership.findMany({
      where: { workspaceId },
      select: { role: true, user: { select: { id: true, name: true, email: true, lastLoginAt: true } } },
      orderBy: { id: "asc" },
    }),
    prisma.workspaceInvitation.findMany({
      where: { workspaceId, createdAt: { gte: desde } },
      select: {
        id: true,
        email: true,
        role: true,
        expiresAt: true,
        acceptedAt: true,
        revokedAt: true,
        sentAt: true,
        sendFailedAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.workspaceAdminEvent.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" }, take: 50 }),
  ]);
  return {
    members: memberships.map((m) => ({
      userId: m.user.id,
      name: m.user.name,
      email: m.user.email,
      role: m.role,
      lastLoginAt: m.user.lastLoginAt,
    })),
    invitations,
    events,
  };
}

export async function changeMemberRole(
  workspaceId: string,
  targetUserId: number,
  newRole: WorkspaceRole,
  actorUserId: number,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const current = await tx.workspaceMembership.findUnique({
      where: { userId_workspaceId: { userId: targetUserId, workspaceId } },
      select: { role: true },
    });
    if (!current) throw new TeamError("NOT_FOUND");
    await tx.workspaceMembership.update({
      where: { userId_workspaceId: { userId: targetUserId, workspaceId } },
      data: { role: newRole },
    });
    await tx.workspaceAdminEvent.create({
      data: { workspaceId, actorUserId, targetUserId, kind: "ROLE_CHANGED", fromRole: current.role, toRole: newRole },
    });
  });
}

export async function removeMember(workspaceId: string, targetUserId: number, actorUserId: number): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const current = await tx.workspaceMembership.findUnique({
      where: { userId_workspaceId: { userId: targetUserId, workspaceId } },
      select: { role: true },
    });
    if (!current) throw new TeamError("NOT_FOUND");
    await tx.workspaceMembership.delete({
      where: { userId_workspaceId: { userId: targetUserId, workspaceId } },
    });
    await tx.workspaceAppAccess.deleteMany({ where: { userId: targetUserId, workspaceId, app: "FOTOFFICE" } });
    await tx.membership.deleteMany({ where: { userId: targetUserId, workspaceId } });
    await tx.workspaceAdminEvent.create({
      data: { workspaceId, actorUserId, targetUserId, kind: "REMOVED", fromRole: current.role },
    });
  });
}
