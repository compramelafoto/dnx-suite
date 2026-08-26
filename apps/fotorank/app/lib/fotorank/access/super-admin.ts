/**
 * Super Admin FotoRank — acceso global + “Actuar como organizador” (sin mutar membresías).
 */
import { cookies, headers } from "next/headers";
import { prisma } from "@repo/db";
import { isGlobalSuperAdmin } from "@repo/auth";
import type { AuthUser } from "../../auth";
import type { UserOrganization } from "../organizations";

export const FOTORANK_SA_ACT_AS_ORG_COOKIE = "fotorank_sa_act_as_org_id";
/** Debe coincidir con `FOTORANK_ACTIVE_ORG_COOKIE` (evitar import circular). */
const ACTIVE_ORG_COOKIE = "fotorank_active_org_id";
const ACT_AS_MAX_AGE = 60 * 60 * 8; // 8h
const ACTIVE_ORG_MAX_AGE = 60 * 60 * 24 * 400;

export function userIsFotorankSuperAdmin(user: {
  globalRole?: string | null;
  role?: string | null;
}): boolean {
  return isGlobalSuperAdmin(user);
}

export async function recordPlatformAudit(input: {
  actorUserId: number;
  action: string;
  organizationId?: string | null;
  contestId?: string | null;
  metadata?: Record<string, unknown> | null;
}): Promise<void> {
  try {
    const h = await headers();
    const ip =
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      h.get("x-real-ip")?.trim() ||
      null;
    const userAgent = h.get("user-agent")?.slice(0, 500) ?? null;
    await prisma.fotorankPlatformAuditEvent.create({
      data: {
        actorUserId: input.actorUserId,
        action: input.action,
        organizationId: input.organizationId ?? null,
        contestId: input.contestId ?? null,
        ip,
        userAgent,
        metadataJson: input.metadata
          ? (JSON.parse(JSON.stringify(input.metadata)) as object)
          : undefined,
      },
    });
  } catch (err) {
    console.error("[fotorank.super-admin] audit failed", err);
  }
}

/** Todas las organizaciones (vista Super Admin). */
export async function listAllOrganizationsForSuperAdmin(): Promise<UserOrganization[]> {
  const rows = await prisma.contestOrganization.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, slug: true },
  });
  return rows.map((o) => ({
    id: o.id,
    name: o.name,
    slug: o.slug,
    role: "SUPER_ADMIN",
  }));
}

export async function getActAsOrganizationId(): Promise<string | null> {
  const jar = await cookies();
  const v = jar.get(FOTORANK_SA_ACT_AS_ORG_COOKIE)?.value?.trim();
  return v || null;
}

export async function setActAsOrganization(params: {
  actor: AuthUser;
  organizationId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!userIsFotorankSuperAdmin(params.actor)) {
    return { ok: false, error: "Solo Super Admin puede actuar como organizador." };
  }
  const org = await prisma.contestOrganization.findUnique({
    where: { id: params.organizationId },
    select: { id: true, name: true },
  });
  if (!org) return { ok: false, error: "Organización no encontrada." };

  const jar = await cookies();
  const secure = process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
  jar.set(FOTORANK_SA_ACT_AS_ORG_COOKIE, org.id, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: ACT_AS_MAX_AGE,
  });
  // Alinea el selector de Concursos / Jurados con el contexto «Actuar como…».
  jar.set(ACTIVE_ORG_COOKIE, org.id, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: ACTIVE_ORG_MAX_AGE,
  });

  await recordPlatformAudit({
    actorUserId: params.actor.id,
    action: "SUPER_ADMIN_ACT_AS_ORGANIZER_START",
    organizationId: org.id,
    metadata: { organizationName: org.name },
  });
  return { ok: true };
}

export async function clearActAsOrganization(actor: AuthUser): Promise<void> {
  const prev = await getActAsOrganizationId();
  const jar = await cookies();
  jar.set(FOTORANK_SA_ACT_AS_ORG_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" || process.env.VERCEL === "1",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });
  if (prev && userIsFotorankSuperAdmin(actor)) {
    await recordPlatformAudit({
      actorUserId: actor.id,
      action: "SUPER_ADMIN_ACT_AS_ORGANIZER_STOP",
      organizationId: prev,
    });
  }
}

/**
 * Orgs visibles en el shell dashboard.
 * Super Admin: todas. Con “Actuar como…”: prioriza esa org en el selector.
 */
export async function resolveOrganizationsForDashboardUser(
  user: AuthUser,
): Promise<{
  organizations: UserOrganization[];
  isSuperAdmin: boolean;
  actAsOrganizationId: string | null;
}> {
  const isSuperAdmin = userIsFotorankSuperAdmin(user);
  const actAsOrganizationId = isSuperAdmin ? await getActAsOrganizationId() : null;

  if (!isSuperAdmin) {
    const { getUserOrganizations } = await import("../organizations");
    return {
      organizations: await getUserOrganizations(user.id),
      isSuperAdmin: false,
      actAsOrganizationId: null,
    };
  }

  const organizations = await listAllOrganizationsForSuperAdmin();
  return { organizations, isSuperAdmin: true, actAsOrganizationId };
}
