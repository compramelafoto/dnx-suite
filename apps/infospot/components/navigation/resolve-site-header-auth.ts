import {
  canAccessInfoSpotAdmin,
  canAccessInfoSpotRedaccion,
  getInfoSpotMembership,
  toPermissionSubject,
} from "@/lib/infospot-access";
import { getAuthUser } from "@/lib/auth";
import { listActivePublicProfiles } from "@/lib/dnx-user-profiles";
import {
  resolveHomeExperience,
  type HomeHeaderLink,
} from "@/lib/home-experience";
import { readPreferredHomeModeFromCookie } from "@/app/actions/home-experience";
import type { SiteHeaderAuth } from "@/components/navigation/HeaderAuthActions";

export type SiteHeaderChrome = {
  auth: SiteHeaderAuth | null;
  primaryCta: HomeHeaderLink | null;
  secondaryLinks: HomeHeaderLink[];
};

/** Resuelve sesión + CTAs de Home adaptativa para el header público. */
export async function resolveSiteHeaderChrome(): Promise<SiteHeaderChrome> {
  const user = await getAuthUser();
  if (!user) {
    const guest = resolveHomeExperience({ activeProfiles: [] });
    return {
      auth: null,
      primaryCta: guest.headerPrimaryCta,
      secondaryLinks: guest.headerSecondaryLinks,
    };
  }

  const [membership, profiles, preferredMode] = await Promise.all([
    getInfoSpotMembership(user.id),
    listActivePublicProfiles(user.id),
    readPreferredHomeModeFromCookie(),
  ]);
  const subject = toPermissionSubject(user, membership);
  const hasPanel =
    user.globalRole === "SUPER_ADMIN" ||
    canAccessInfoSpotRedaccion(subject) ||
    canAccessInfoSpotAdmin(subject);

  const emailLocal = user.email.includes("@")
    ? user.email.slice(0, user.email.indexOf("@"))
    : user.email;
  const label = user.name?.trim() || emailLocal;

  const experience = resolveHomeExperience({
    activeProfiles: profiles.map((p) => p.profileType),
    preferredMode,
  });

  return {
    auth: {
      label,
      panelHref: hasPanel ? "/redaccion" : "/",
      panelLabel: hasPanel ? "Panel" : "Inicio",
    },
    primaryCta: experience.headerPrimaryCta,
    secondaryLinks: experience.headerSecondaryLinks,
  };
}

/** @deprecated Preferí resolveSiteHeaderChrome */
export async function resolveSiteHeaderAuth(): Promise<SiteHeaderAuth | null> {
  const chrome = await resolveSiteHeaderChrome();
  return chrome.auth;
}
