import { prisma } from "@repo/db";
import { isFotofficePlatformAdminRole, resolvePlatformRole } from "./fotoffice-roles";

/**
 * Admin de plataforma: solo `SUPER_ADMIN`.
 * Fallback opcional por email en `FOTOFFICE_PLATFORM_ADMIN_EMAILS` (coma-separado).
 * Útil mientras una base no tenga sincronizados enums/migraciones de roles.
 */
export async function isFotofficePlatformAdmin(userId: number): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, role: true, globalRole: true },
  });
  if (!user?.email) return false;
  if (isFotofficePlatformAdminRole(resolvePlatformRole({ globalRole: user.globalRole, legacyRole: user.role }))) {
    return true;
  }
  const raw = process.env.FOTOFFICE_PLATFORM_ADMIN_EMAILS?.trim();
  const allow = raw
    ? raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)
    : [];
  return allow.includes(user.email.toLowerCase());
}
