/**
 * Gestión canónica de `User.globalRole` (DNX Identity).
 * Fuente de verdad suite-wide: SUPER_ADMIN | PLATFORM_SUPPORT | USER.
 */
import { prisma } from "./prisma";

export type GlobalRoleName = "SUPER_ADMIN" | "PLATFORM_SUPPORT" | "USER";

export type GrantGlobalRoleResult =
  | {
      ok: true;
      userId: number;
      email: string;
      previousGlobalRole: string | null;
      globalRole: GlobalRoleName;
      changed: boolean;
    }
  | { ok: false; reason: "NOT_FOUND" | "BLOCKED" };

/**
 * Asigna un globalRole de forma idempotente.
 * No toca membresías de organización ni AppAccess de workspace.
 * No modifica otros usuarios.
 */
export async function grantGlobalRole(params: {
  email: string;
  role: GlobalRoleName;
  /** Si true, también alinea `User.role` legado cuando role=SUPER_ADMIN. Default false. */
  syncLegacyRole?: boolean;
}): Promise<GrantGlobalRoleResult> {
  const email = params.email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      globalRole: true,
      role: true,
      isBlocked: true,
    },
  });
  if (!user) return { ok: false, reason: "NOT_FOUND" };
  if (user.isBlocked) return { ok: false, reason: "BLOCKED" };

  const previous =
    user.globalRole != null ? String(user.globalRole) : null;
  const already = previous === params.role;
  if (already && !params.syncLegacyRole) {
    return {
      ok: true,
      userId: user.id,
      email: user.email,
      previousGlobalRole: previous,
      globalRole: params.role,
      changed: false,
    };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      globalRole: params.role,
      ...(params.syncLegacyRole && params.role === "SUPER_ADMIN"
        ? { role: "SUPER_ADMIN" as const }
        : {}),
    },
  });

  return {
    ok: true,
    userId: user.id,
    email: user.email,
    previousGlobalRole: previous,
    globalRole: params.role,
    changed: !already || Boolean(params.syncLegacyRole && user.role !== "SUPER_ADMIN"),
  };
}

/** Atajo semántico FotoRank / suite. */
export async function ensureGlobalSuperAdmin(email: string): Promise<GrantGlobalRoleResult> {
  return grantGlobalRole({
    email,
    role: "SUPER_ADMIN",
    syncLegacyRole: true,
  });
}

export function isGlobalSuperAdmin(user: {
  globalRole?: string | null;
  role?: string | null;
}): boolean {
  return user.globalRole === "SUPER_ADMIN" || user.role === "SUPER_ADMIN";
}
