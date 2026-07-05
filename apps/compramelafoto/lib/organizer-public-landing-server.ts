import { Role } from "@prisma/client";
import { sanitizeExternalUrl } from "@/lib/organizer-landing-profile";
import {
  isModuleEnabled,
  parseOrganizerLandingModules,
  type OrganizerLandingModulesConfig,
} from "@/lib/organizer-landing-modules";
import {
  getOrganizerFeaturedGalleries,
  getOrganizerPastEvents,
  getOrganizerPrimaryUpcomingEventSlug,
  getOrganizerPublicPhotographers,
  getOrganizerUpcomingEvents,
  resolveOrganizerOfficialPhotographersForPublic,
  r2PublicUrl,
  type OrganizerPublicFeaturedGallery,
  type OrganizerPublicLandingEvent,
  type OrganizerPublicPhotographerCard,
  type OrganizerPublicSponsor,
} from "@/lib/organizer-public-landing-data";
import { prisma } from "@/lib/prisma";
import { getPublicSiteOrigin } from "@/lib/public-site-url";

export type {
  OrganizerPublicLandingEvent,
  OrganizerPublicSponsor,
  OrganizerPublicFeaturedGallery,
  OrganizerPublicPhotographerCard,
};

export type OrganizerPublicLandingView = {
  displayName: string;
  tagline: string | null;
  description: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  city: string | null;
  zone: string | null;
  website: string | null;
  instagram: string | null;
  whatsapp: string | null;
  publicEmail: string | null;
  modules: OrganizerLandingModulesConfig;
  upcomingEvents: OrganizerPublicLandingEvent[];
  pastEvents: OrganizerPublicLandingEvent[];
  sponsors: OrganizerPublicSponsor[];
  featuredGalleries: OrganizerPublicFeaturedGallery[];
  officialPhotographers: OrganizerPublicPhotographerCard[];
  frequentPhotographers: OrganizerPublicPhotographerCard[];
  photographerCallEventSlug: string | null;
  publicSlug: string;
};

export async function getPublishedOrganizerLandingBySlug(
  slug: string
): Promise<OrganizerPublicLandingView | null> {
  const normalizedSlug = slug.toLowerCase();
  const profile = await prisma.organizerPublicProfile.findFirst({
    where: {
      publicSlug: normalizedSlug,
      isPublished: true,
      user: { role: { in: [Role.ORGANIZER, Role.SCHOOL_ORGANIZER] } },
    },
    select: {
      id: true,
      userId: true,
      publicSlug: true,
      displayName: true,
      tagline: true,
      description: true,
      logoR2Key: true,
      bannerR2Key: true,
      primaryColor: true,
      secondaryColor: true,
      city: true,
      zone: true,
      website: true,
      instagram: true,
      whatsapp: true,
      publicEmail: true,
      modulesJson: true,
    },
  });

  if (!profile) return null;

  const modules = parseOrganizerLandingModules(profile.modulesJson);

  const [
    upcomingEvents,
    pastEvents,
    sponsorRows,
    featuredGalleries,
    photographersLanding,
    photographerCallEventSlug,
    officialPhotographersResolved,
  ] = await Promise.all([
    isModuleEnabled(modules, "upcomingEvents")
      ? getOrganizerUpcomingEvents(profile.userId)
      : Promise.resolve([]),
    isModuleEnabled(modules, "pastEvents")
      ? getOrganizerPastEvents(profile.userId)
      : Promise.resolve([]),
    isModuleEnabled(modules, "sponsors")
      ? prisma.organizerLandingSponsor.findMany({
          where: {
            profileId: profile.id,
            isActive: true,
            logoR2Key: { not: null },
          },
          orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
          select: { id: true, name: true, url: true, logoR2Key: true },
        })
      : Promise.resolve([]),
    isModuleEnabled(modules, "featuredGalleries")
      ? getOrganizerFeaturedGalleries(profile.id, profile.userId)
      : Promise.resolve([]),
    isModuleEnabled(modules, "officialPhotographers") || isModuleEnabled(modules, "frequentPhotographers")
      ? getOrganizerPublicPhotographers(profile.userId)
      : Promise.resolve({ official: [], frequent: [] }),
    isModuleEnabled(modules, "photographerCall")
      ? getOrganizerPrimaryUpcomingEventSlug(profile.userId)
      : Promise.resolve(null),
    isModuleEnabled(modules, "officialPhotographers")
      ? resolveOrganizerOfficialPhotographersForPublic(profile.id, profile.userId)
      : Promise.resolve([]),
  ]);

  const sponsors: OrganizerPublicSponsor[] = sponsorRows
    .map((s) => {
      const logoUrl = r2PublicUrl(s.logoR2Key);
      if (!logoUrl) return null;
      return {
        id: s.id,
        name: s.name,
        url: sanitizeExternalUrl(s.url),
        logoUrl,
      };
    })
    .filter((s): s is OrganizerPublicSponsor => s != null);

  return {
    publicSlug: profile.publicSlug,
    displayName: profile.displayName,
    tagline: profile.tagline,
    description: profile.description,
    logoUrl: r2PublicUrl(profile.logoR2Key),
    bannerUrl: r2PublicUrl(profile.bannerR2Key),
    primaryColor: profile.primaryColor,
    secondaryColor: profile.secondaryColor,
    city: profile.city,
    zone: profile.zone,
    website: profile.website,
    instagram: profile.instagram,
    whatsapp: profile.whatsapp,
    publicEmail: profile.publicEmail,
    modules,
    upcomingEvents,
    pastEvents,
    sponsors,
    featuredGalleries,
    officialPhotographers: isModuleEnabled(modules, "officialPhotographers")
      ? officialPhotographersResolved
      : [],
    frequentPhotographers: isModuleEnabled(modules, "frequentPhotographers")
      ? photographersLanding.frequent
      : [],
    photographerCallEventSlug,
  };
}

export async function getOrganizerLandingMetadataBySlug(slug: string) {
  const normalizedSlug = slug.toLowerCase();
  const profile = await prisma.organizerPublicProfile.findFirst({
    where: {
      publicSlug: normalizedSlug,
      isPublished: true,
      user: { role: { in: [Role.ORGANIZER, Role.SCHOOL_ORGANIZER] } },
    },
    select: {
      displayName: true,
      tagline: true,
      description: true,
      seoTitle: true,
      seoDescription: true,
      logoR2Key: true,
      bannerR2Key: true,
      city: true,
      zone: true,
    },
  });
  if (!profile) return null;

  const base = getPublicSiteOrigin();

  const title = profile.seoTitle?.trim() || profile.displayName;
  const location = [profile.city, profile.zone].filter(Boolean).join(" · ");
  const description =
    profile.seoDescription?.trim() ||
    profile.tagline?.trim() ||
    profile.description?.trim()?.slice(0, 160) ||
    (location
      ? `Eventos, galerías y fotografía con ${profile.displayName} en ${location}.`
      : `Eventos y fotografía con ${profile.displayName}.`);

  // Compartir en redes: priorizar logo del club (no el banner hero).
  const logoImage = r2PublicUrl(profile.logoR2Key);
  const bannerImage = r2PublicUrl(profile.bannerR2Key);
  const ogImage = logoImage || bannerImage || `${base}/watermark.png`;

  return {
    title,
    description,
    ogImage,
    logoUrl: logoImage,
    canonical: `${base}/${normalizedSlug}`,
  };
}
