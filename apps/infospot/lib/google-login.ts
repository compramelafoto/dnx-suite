import type { NextResponse } from "next/server";
import {
  DNX_APP_INFOSPOT,
  DNX_SESSION_COOKIE,
  createUserSession,
  findPendingAppInvitationByEmail,
  type DnxInvitationRecord,
} from "@repo/auth";
import { prisma, resolveInfoSpotPublicationFields } from "@repo/db";
import { SESSION_COOKIE_OPTIONS } from "@/lib/session-cookie";
import {
  canAccessInfoSpotAdmin,
  canAccessInfoSpotRedaccion,
  getInfoSpotMembership,
  toPermissionSubject,
} from "@/lib/infospot-access";
import type { AuthUser } from "@/lib/auth";
import { safeInfoSpotNextPath } from "@/lib/google-oauth-start";

export {
  buildGoogleOAuthStartHref,
  friendlyGoogleLoginError,
  safeInfoSpotNextPath,
} from "@/lib/google-oauth-start";

export const INFOSPOT_GOOGLE_OAUTH_APP = "infospot";

/**
 * Destino post-login según rol Info Spot.
 * Si `next` es un path seguro distinto del default y el usuario tiene acceso, se respeta.
 */
export function resolveInfoSpotPostLoginPath(params: {
  suiteRole: string;
  membershipRole: string | null;
  membershipStatus: string | null;
  next?: string | null;
}): { path: string; hasAccess: boolean } {
  const isSuperAdmin = params.suiteRole === "SUPER_ADMIN";
  const active =
    params.membershipStatus === "ACTIVE" || isSuperAdmin;
  const role = isSuperAdmin
    ? params.membershipRole ?? "INFOSPOT_DIRECTOR"
    : params.membershipRole;

  const subject = toPermissionSubject(
    {
      id: 0,
      name: null,
      email: "",
      role: params.suiteRole,
      globalRole: isSuperAdmin ? "SUPER_ADMIN" : "USER",
      avatarUrl: null,
      currentWorkspaceId: null,
      workspaceRole: null,
      appAccess: [],
    } satisfies AuthUser,
    active && role
      ? {
          id: "",
          userId: 0,
          role,
          canPublish: true,
          publicationPolicy: "DIRECT_PUBLISH",
          status: "ACTIVE",
        }
      : null,
  );

  const hasAccess =
    isSuperAdmin ||
    canAccessInfoSpotRedaccion(subject) ||
    canAccessInfoSpotAdmin(subject);

  if (!hasAccess) {
    return { path: "/ingresar/acceso-pendiente", hasAccess: false };
  }

  // Director / Redactor / Colaborador → /redaccion (default).
  // Se respeta `next` seguro distinto del login.
  const next = safeInfoSpotNextPath(params.next, "");
  if (next && next !== "/redaccion" && next !== "/ingresar" && next !== "/ingresar/acceso-pendiente") {
    return { path: next, hasAccess: true };
  }

  return { path: "/redaccion", hasAccess: true };
}

export async function attachInfoSpotSessionCookieToResponse(
  response: NextResponse,
  userId: number,
  options?: { rememberMe?: boolean },
): Promise<void> {
  const session = await createUserSession(userId, {
    rememberMe: options?.rememberMe === true,
  });
  response.cookies.set(DNX_SESSION_COOKIE, session.rawToken, {
    ...SESSION_COOKIE_OPTIONS,
    maxAge: session.maxAge,
  });
}

export async function activateInfoSpotInvitationForUser(params: {
  userId: number;
  invitation: DnxInvitationRecord;
}): Promise<void> {
  const fields = resolveInfoSpotPublicationFields({
    role: params.invitation.appRole,
    canPublish:
      params.invitation.appRole === "INFOSPOT_DIRECTOR"
        ? true
        : params.invitation.appRole === "INFOSPOT_COLABORADOR"
          ? false
          : params.invitation.canPublish,
  });

  await prisma.infoSpotUserRole.upsert({
    where: { userId: params.userId },
    create: {
      userId: params.userId,
      role: params.invitation.appRole as
        | "INFOSPOT_DIRECTOR"
        | "INFOSPOT_REDACTOR"
        | "INFOSPOT_COLABORADOR",
      canPublish: fields.canPublish,
      publicationPolicy: fields.publicationPolicy,
      status: "ACTIVE",
      assignedByUserId: params.invitation.invitedByUserId,
      lastChangedByUserId: params.invitation.invitedByUserId,
    },
    update: {
      role: params.invitation.appRole as
        | "INFOSPOT_DIRECTOR"
        | "INFOSPOT_REDACTOR"
        | "INFOSPOT_COLABORADOR",
      canPublish: fields.canPublish,
      publicationPolicy: fields.publicationPolicy,
      status: "ACTIVE",
      lastChangedByUserId: params.invitation.invitedByUserId,
    },
  });

  await (prisma as typeof prisma & {
    dnxAppInvitation: {
      update(args: unknown): Promise<unknown>;
    };
  }).dnxAppInvitation.update({
    where: { id: params.invitation.id },
    data: {
      status: "ACCEPTED",
      acceptedAt: new Date(),
      acceptedUserId: params.userId,
      updatedAt: new Date(),
    },
  });
}

export async function findInfoSpotPendingInvitation(email: string) {
  return findPendingAppInvitationByEmail({
    email,
    app: DNX_APP_INFOSPOT,
  });
}

export async function loadPostLoginDestination(userId: number, suiteRole: string, next?: string | null) {
  const membership = await getInfoSpotMembership(userId);
  return resolveInfoSpotPostLoginPath({
    suiteRole,
    membershipRole: membership?.role ?? null,
    membershipStatus: membership?.status ?? null,
    next,
  });
}
