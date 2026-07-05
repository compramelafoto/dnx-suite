import { prisma } from "@/lib/prisma";
import {
  mapUserRowToPhotographerBrandingSource,
  type PhotographerBrandingSource,
} from "./quote-branding-snapshot";

const PHOTOGRAPHER_BRANDING_USER_SELECT = {
  email: true,
  name: true,
  companyName: true,
  companyOwner: true,
  logoUrl: true,
  primaryColor: true,
  secondaryColor: true,
  tertiaryColor: true,
  fontColor: true,
  headerBackgroundColor: true,
  footerBackgroundColor: true,
  heroBackgroundColor: true,
  pageBackgroundColor: true,
  phone: true,
  whatsapp: true,
  website: true,
  instagram: true,
} as const;

export async function fetchPhotographerBrandingSourceForUser(
  userId: number,
): Promise<PhotographerBrandingSource | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: PHOTOGRAPHER_BRANDING_USER_SELECT,
  });
  if (!user) return null;
  return mapUserRowToPhotographerBrandingSource(user);
}
