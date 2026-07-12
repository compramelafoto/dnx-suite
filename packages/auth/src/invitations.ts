import { prisma } from "./prisma";
import { createOpaqueToken, hashOpaqueToken, hashPassword } from "./password";
import {
  invitationEmailContent,
  roleAssignedEmailContent,
  sendIdentityEmail,
  type IdentityEmailResult,
} from "./email";

export const DNX_INVITATION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 días
export const DNX_APP_INFOSPOT = "infospot" as const;

export type DnxInvitationRecord = {
  id: string;
  email: string;
  app: string;
  appRole: string;
  canPublish: boolean;
  status: string;
  expiresAt: Date;
  invitedByUserId: number;
  acceptedAt: Date | null;
  acceptedUserId: number | null;
  revokedAt: Date | null;
  lastSentAt: Date | null;
  createdAt: Date;
};

export type InviteOrAssignResult =
  | {
      kind: "assigned_existing";
      userId: number;
      email: string;
      emailResult: IdentityEmailResult;
    }
  | {
      kind: "invitation_created" | "invitation_resent";
      invitationId: string;
      email: string;
      rawToken: string;
      inviteUrl: string;
      emailResult: IdentityEmailResult;
    };

function invitationDelegate() {
  return (prisma as typeof prisma & {
    dnxAppInvitation: {
      findFirst(args: unknown): Promise<DnxInvitationRecord | null>;
      findUnique(args: unknown): Promise<DnxInvitationRecord | null>;
      findMany(args: unknown): Promise<DnxInvitationRecord[]>;
      create(args: unknown): Promise<DnxInvitationRecord>;
      update(args: unknown): Promise<DnxInvitationRecord>;
      updateMany(args: unknown): Promise<{ count: number }>;
    };
  }).dnxAppInvitation;
}

export function buildInviteUrl(params: {
  appBaseUrl: string;
  rawToken: string;
  path?: string;
}): string {
  const base = params.appBaseUrl.replace(/\/$/, "");
  const path = params.path ?? "/invitar";
  return `${base}${path}/${params.rawToken}`;
}

/**
 * Invita por email o asigna rol si el User ya existe.
 * Nunca genera ni envía contraseñas.
 */
export async function inviteOrAssignAppAccess(params: {
  email: string;
  app: string;
  appRole: string;
  canPublish?: boolean;
  invitedByUserId: number;
  appBaseUrl: string;
  appLabel: string;
  roleLabel: string;
  loginPath?: string;
  invitePath?: string;
  /** Callback app-específica para upsert del rol (p. ej. InfoSpotUserRole). */
  onAssignExistingUser: (userId: number) => Promise<void>;
}): Promise<InviteOrAssignResult> {
  const email = params.email.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    throw new Error("Email inválido.");
  }

  const canPublish = params.canPublish ?? false;
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, isBlocked: true },
  });

  if (user) {
    if (user.isBlocked) {
      throw new Error("Esa cuenta está bloqueada a nivel suite.");
    }
    await params.onAssignExistingUser(user.id);

    // Cerrar invitaciones pendientes del mismo email+app.
    await invitationDelegate().updateMany({
      where: { email, app: params.app, status: "PENDING" },
      data: {
        status: "ACCEPTED",
        acceptedAt: new Date(),
        acceptedUserId: user.id,
        updatedAt: new Date(),
      },
    });

    const loginUrl = `${params.appBaseUrl.replace(/\/$/, "")}${params.loginPath ?? "/ingresar"}`;
    const content = roleAssignedEmailContent({
      appLabel: params.appLabel,
      loginUrl,
      roleLabel: params.roleLabel,
    });
    const emailResult = await sendIdentityEmail({
      to: email,
      subject: content.subject,
      html: content.html,
      text: content.text,
      templateKey: "dnx.identity.role_assigned",
    });

    return {
      kind: "assigned_existing",
      userId: user.id,
      email,
      emailResult,
    };
  }

  // Usuario nuevo → invitación pendiente
  const existingPending = await invitationDelegate().findFirst({
    where: { email, app: params.app, status: "PENDING" },
    orderBy: { createdAt: "desc" },
  });

  const { rawToken, tokenHash } = createOpaqueToken();
  const expiresAt = new Date(Date.now() + DNX_INVITATION_TTL_MS);
  const inviteUrl = buildInviteUrl({
    appBaseUrl: params.appBaseUrl,
    rawToken,
    path: params.invitePath,
  });

  let invitation: DnxInvitationRecord;
  let kind: "invitation_created" | "invitation_resent";

  if (existingPending) {
    invitation = await invitationDelegate().update({
      where: { id: existingPending.id },
      data: {
        appRole: params.appRole,
        canPublish,
        tokenHash,
        expiresAt,
        invitedByUserId: params.invitedByUserId,
        lastSentAt: new Date(),
        updatedAt: new Date(),
      },
    });
    kind = "invitation_resent";
  } else {
    invitation = await invitationDelegate().create({
      data: {
        email,
        app: params.app,
        appRole: params.appRole,
        canPublish,
        status: "PENDING",
        tokenHash,
        expiresAt,
        invitedByUserId: params.invitedByUserId,
        lastSentAt: new Date(),
      },
    });
    kind = "invitation_created";
  }

  const inviter = await prisma.user.findUnique({
    where: { id: params.invitedByUserId },
    select: { name: true, email: true },
  });
  const content = invitationEmailContent({
    appLabel: params.appLabel,
    inviteUrl,
    roleLabel: params.roleLabel,
    inviterLabel: inviter?.name?.trim() || inviter?.email,
  });
  const emailResult = await sendIdentityEmail({
    to: email,
    subject: content.subject,
    html: content.html,
    text: content.text,
    templateKey: "dnx.identity.invitation",
  });

  return {
    kind,
    invitationId: invitation.id,
    email,
    rawToken,
    inviteUrl,
    emailResult,
  };
}

export async function resendAppInvitation(params: {
  invitationId: string;
  invitedByUserId: number;
  appBaseUrl: string;
  appLabel: string;
  roleLabel: string;
  invitePath?: string;
}): Promise<{ rawToken: string; inviteUrl: string; emailResult: IdentityEmailResult }> {
  const row = await invitationDelegate().findUnique({
    where: { id: params.invitationId },
  });
  if (!row || row.status !== "PENDING") {
    throw new Error("Invitación no encontrada o no está pendiente.");
  }
  if (row.expiresAt.getTime() <= Date.now()) {
    await invitationDelegate().update({
      where: { id: row.id },
      data: { status: "EXPIRED", updatedAt: new Date() },
    });
    throw new Error("La invitación venció. Creá una nueva.");
  }

  const { rawToken, tokenHash } = createOpaqueToken();
  const expiresAt = new Date(Date.now() + DNX_INVITATION_TTL_MS);
  await invitationDelegate().update({
    where: { id: row.id },
    data: {
      tokenHash,
      expiresAt,
      invitedByUserId: params.invitedByUserId,
      lastSentAt: new Date(),
      updatedAt: new Date(),
    },
  });

  const inviteUrl = buildInviteUrl({
    appBaseUrl: params.appBaseUrl,
    rawToken,
    path: params.invitePath,
  });
  const inviter = await prisma.user.findUnique({
    where: { id: params.invitedByUserId },
    select: { name: true, email: true },
  });
  const content = invitationEmailContent({
    appLabel: params.appLabel,
    inviteUrl,
    roleLabel: params.roleLabel,
    inviterLabel: inviter?.name?.trim() || inviter?.email,
  });
  const emailResult = await sendIdentityEmail({
    to: row.email,
    subject: content.subject,
    html: content.html,
    text: content.text,
    templateKey: "dnx.identity.invitation_resend",
  });

  return { rawToken, inviteUrl, emailResult };
}

export async function revokeAppInvitation(invitationId: string): Promise<void> {
  const row = await invitationDelegate().findUnique({ where: { id: invitationId } });
  if (!row) throw new Error("Invitación no encontrada.");
  if (row.status !== "PENDING") {
    throw new Error("Solo se pueden revocar invitaciones pendientes.");
  }
  await invitationDelegate().update({
    where: { id: invitationId },
    data: {
      status: "REVOKED",
      revokedAt: new Date(),
      updatedAt: new Date(),
    },
  });
}

export async function getInvitationByRawToken(
  rawToken: string,
): Promise<DnxInvitationRecord | null> {
  const tokenHash = hashOpaqueToken(rawToken);
  const row = await invitationDelegate().findUnique({ where: { tokenHash } });
  if (!row) return null;
  if (row.status === "PENDING" && row.expiresAt.getTime() <= Date.now()) {
    await invitationDelegate().update({
      where: { id: row.id },
      data: { status: "EXPIRED", updatedAt: new Date() },
    });
    return { ...row, status: "EXPIRED" };
  }
  return row;
}

export async function listPendingInvitations(params: {
  app: string;
}): Promise<DnxInvitationRecord[]> {
  await invitationDelegate().updateMany({
    where: {
      app: params.app,
      status: "PENDING",
      expiresAt: { lt: new Date() },
    },
    data: { status: "EXPIRED", updatedAt: new Date() },
  });

  return invitationDelegate().findMany({
    where: { app: params.app, status: "PENDING" },
    orderBy: { createdAt: "desc" },
  });
}

/** Invitación PENDING vigente por email + app (p. ej. aceptar con Google). */
export async function findPendingAppInvitationByEmail(params: {
  email: string;
  app: string;
}): Promise<DnxInvitationRecord | null> {
  const email = params.email.trim().toLowerCase();
  if (!email) return null;

  await invitationDelegate().updateMany({
    where: {
      email,
      app: params.app,
      status: "PENDING",
      expiresAt: { lt: new Date() },
    },
    data: { status: "EXPIRED", updatedAt: new Date() },
  });

  return invitationDelegate().findFirst({
    where: { email, app: params.app, status: "PENDING" },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Acepta invitación: crea User si no existe, setea password, marca accepted.
 * `onActivate` asigna el rol de app (InfoSpotUserRole, etc.).
 */
export async function acceptAppInvitation(params: {
  rawToken: string;
  name: string;
  password: string;
  onActivate: (userId: number, invitation: DnxInvitationRecord) => Promise<void>;
}): Promise<{ userId: number; email: string; app: string }> {
  const name = params.name.trim();
  const password = params.password;
  if (name.length < 2) throw new Error("El nombre es obligatorio.");
  if (password.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres.");

  const invitation = await getInvitationByRawToken(params.rawToken);
  if (!invitation || invitation.status !== "PENDING") {
    throw new Error("Invitación inválida, revocada o vencida.");
  }

  const passwordHash = hashPassword(password);

  let user = await prisma.user.findUnique({
    where: { email: invitation.email },
    select: { id: true, isBlocked: true, password: true },
  });

  if (user?.isBlocked) {
    throw new Error("Esta cuenta está bloqueada.");
  }

  if (!user) {
    user = (await prisma.user.create({
      data: {
        email: invitation.email,
        name,
        password: passwordHash,
        role: "CUSTOMER",
        emailVerifiedAt: new Date(),
      },
      select: { id: true, isBlocked: true, password: true },
    })) as { id: number; isBlocked: boolean; password: string | null };
  } else {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        name,
        ...(user.password ? {} : { password: passwordHash }),
        emailVerifiedAt: new Date(),
      },
    });
  }

  await params.onActivate(user.id, invitation);

  await invitationDelegate().update({
    where: { id: invitation.id },
    data: {
      status: "ACCEPTED",
      acceptedAt: new Date(),
      acceptedUserId: user.id,
      updatedAt: new Date(),
    },
  });

  return { userId: user.id, email: invitation.email, app: invitation.app };
}
