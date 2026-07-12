import { redirect } from "next/navigation";
import { prisma } from "@repo/db";
import {
  canAccessInfoSpotAdmin,
  canAccessInfoSpotRedaccion,
  canCreateInfoSpotArticle,
  canEditInfoSpotArticle,
  canCreateInfoSpotEvent,
  canEditInfoSpotEvent,
  canManageInfoSpotSettings,
  canManageInfoSpotUsers,
  canModerateInfoSpotEvents,
  canManageInfoSpotDistribution,
  canPublishInfoSpotArticle,
  canPublishInfoSpotEvent,
  canReviewInfoSpotApprovals,
  canViewInfoSpotPublishedEvents,
  resolveInfoSpotPublicationFields,
  type InfoSpotPermissionSubject,
  type InfoSpotPublicationPolicyName,
} from "@repo/db";
import { getAuthUser, requireAuth, type AuthUser } from "@/lib/auth";

export type InfoSpotMembership = {
  id: string;
  userId: number;
  role: string;
  canPublish: boolean;
  publicationPolicy: InfoSpotPublicationPolicyName;
  status: string;
};

export type InfoSpotAccessContext = {
  user: AuthUser;
  membership: InfoSpotMembership | null;
  subject: InfoSpotPermissionSubject;
};

export async function getInfoSpotMembership(userId: number): Promise<InfoSpotMembership | null> {
  const row = await prisma.infoSpotUserRole.findUnique({
    where: { userId },
    select: {
      id: true,
      userId: true,
      role: true,
      canPublish: true,
      publicationPolicy: true,
      status: true,
    },
  });
  if (!row) return null;
  const synced = resolveInfoSpotPublicationFields({
    role: row.role,
    publicationPolicy: row.publicationPolicy,
    canPublish: row.canPublish,
  });
  return {
    id: row.id,
    userId: row.userId,
    role: row.role,
    canPublish: synced.canPublish,
    publicationPolicy: synced.publicationPolicy,
    status: row.status,
  };
}

export function toPermissionSubject(
  user: AuthUser,
  membership: InfoSpotMembership | null,
): InfoSpotPermissionSubject | null {
  if (user.globalRole === "SUPER_ADMIN") {
    return {
      role: membership?.role ?? "INFOSPOT_DIRECTOR",
      canPublish: true,
      publicationPolicy: "DIRECT_PUBLISH",
      status: "ACTIVE",
      isSuperAdmin: true,
    };
  }
  if (!membership) return null;
  return {
    role: membership.role,
    canPublish: membership.canPublish,
    publicationPolicy: membership.publicationPolicy,
    status: membership.status,
    isSuperAdmin: false,
  };
}

export async function getInfoSpotAccessContext(): Promise<InfoSpotAccessContext | null> {
  const user = await getAuthUser();
  if (!user) return null;
  const membership = await getInfoSpotMembership(user.id);
  const subject = toPermissionSubject(user, membership);
  if (!subject) {
    return {
      user,
      membership,
      subject: {
        role: "",
        canPublish: false,
        publicationPolicy: "REQUIRES_APPROVAL",
        status: "DISABLED",
      },
    };
  }
  return { user, membership, subject };
}

export async function requireInfoSpotRedaccionAccess(): Promise<InfoSpotAccessContext> {
  const user = await requireAuth();
  const membership = await getInfoSpotMembership(user.id);
  const subject = toPermissionSubject(user, membership);
  if (!canAccessInfoSpotRedaccion(subject)) {
    redirect("/ingresar?forbidden=infospot-redaccion");
  }
  return { user, membership, subject: subject! };
}

export async function requireInfoSpotAdminAccess(): Promise<InfoSpotAccessContext> {
  const user = await requireAuth();
  const membership = await getInfoSpotMembership(user.id);
  const subject = toPermissionSubject(user, membership);
  if (!canAccessInfoSpotAdmin(subject)) {
    redirect("/ingresar?forbidden=infospot-admin");
  }
  return { user, membership, subject: subject! };
}

/** DIRECTOR (moderar) o REDACTOR (solo publicados). */
export async function requireInfoSpotEventsPanelAccess(): Promise<InfoSpotAccessContext> {
  const user = await requireAuth();
  const membership = await getInfoSpotMembership(user.id);
  const subject = toPermissionSubject(user, membership);
  const allowed =
    canModerateInfoSpotEvents(subject) || canViewInfoSpotPublishedEvents(subject);
  if (!allowed) {
    redirect("/ingresar?forbidden=infospot-events");
  }
  return { user, membership, subject: subject! };
}

export {
  canManageInfoSpotSettings,
  canManageInfoSpotUsers,
  canCreateInfoSpotArticle,
  canEditInfoSpotArticle,
  canCreateInfoSpotEvent,
  canEditInfoSpotEvent,
  canPublishInfoSpotArticle,
  canReviewInfoSpotApprovals,
  canAccessInfoSpotRedaccion,
  canAccessInfoSpotAdmin,
  canModerateInfoSpotEvents,
  canManageInfoSpotDistribution,
  canViewInfoSpotPublishedEvents,
  canPublishInfoSpotEvent,
};
