import { parseOrganizerLandingModules } from "@/lib/organizer-landing-modules";
import { getR2PublicUrl } from "@/lib/r2-client";
import type { OrganizerPublicProfile } from "@prisma/client";

function r2PublicUrl(key: string | null | undefined): string | null {
  if (!key?.trim()) return null;
  return getR2PublicUrl(key.replace(/^\//, ""));
}

export function mapOrganizerLandingProfile(profile: OrganizerPublicProfile) {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://compramelafoto.com");
  const base = siteUrl.replace(/\/$/, "");

  return {
    id: profile.id,
    userId: profile.userId,
    publicSlug: profile.publicSlug,
    isPublished: profile.isPublished,
    displayName: profile.displayName,
    tagline: profile.tagline,
    description: profile.description,
    logoR2Key: profile.logoR2Key,
    bannerR2Key: profile.bannerR2Key,
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
    modulesJson: parseOrganizerLandingModules(profile.modulesJson),
    seoTitle: profile.seoTitle,
    seoDescription: profile.seoDescription,
    publicUrl: profile.isPublished ? `${base}/${profile.publicSlug}` : null,
    updatedAt: profile.updatedAt.toISOString(),
  };
}
