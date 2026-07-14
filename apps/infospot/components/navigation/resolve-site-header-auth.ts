import {
  canAccessInfoSpotAdmin,
  canAccessInfoSpotRedaccion,
  getInfoSpotMembership,
  toPermissionSubject,
} from "@/lib/infospot-access";
import { getAuthUser } from "@/lib/auth";
import type { SiteHeaderAuth } from "@/components/navigation/HeaderAuthActions";

/** Resuelve estado de sesión para el header público (sin lanzar redirects). */
export async function resolveSiteHeaderAuth(): Promise<SiteHeaderAuth | null> {
  const user = await getAuthUser();
  if (!user) return null;

  const membership = await getInfoSpotMembership(user.id);
  const subject = toPermissionSubject(user, membership);
  const hasPanel =
    user.globalRole === "SUPER_ADMIN" ||
    canAccessInfoSpotRedaccion(subject) ||
    canAccessInfoSpotAdmin(subject);

  const emailLocal = user.email.includes("@")
    ? user.email.slice(0, user.email.indexOf("@"))
    : user.email;
  const label = user.name?.trim() || emailLocal;

  return {
    label,
    panelHref: hasPanel ? "/redaccion" : "/",
    panelLabel: hasPanel ? "Panel" : "Inicio",
  };
}
