import { prisma } from "@repo/db";

/** Perfil institucional serializable (panel + landing). */
export type ContestOrganizationProfileDTO = {
  id: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  description: string | null;
  logoUrl: string | null;
  coverImageUrl: string | null;
  website: string | null;
  contactEmail: string | null;
  phone: string | null;
  whatsapp: string | null;
  instagram: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
};

export function mapOrganizationToProfileDTO(row: {
  id: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  description: string | null;
  logoUrl: string | null;
  coverImageUrl: string | null;
  website: string | null;
  contactEmail: string | null;
  phone: string | null;
  whatsapp: string | null;
  instagram: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
}): ContestOrganizationProfileDTO {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    shortDescription: row.shortDescription,
    description: row.description,
    logoUrl: row.logoUrl,
    coverImageUrl: row.coverImageUrl,
    website: row.website,
    contactEmail: row.contactEmail,
    phone: row.phone,
    whatsapp: row.whatsapp,
    instagram: row.instagram,
    address: row.address,
    city: row.city,
    country: row.country,
  };
}

export async function getContestOrganizationProfileById(
  organizationId: string,
): Promise<ContestOrganizationProfileDTO | null> {
  const row = await prisma.contestOrganization.findUnique({
    where: { id: organizationId },
  });
  if (!row) return null;
  return mapOrganizationToProfileDTO(row);
}
