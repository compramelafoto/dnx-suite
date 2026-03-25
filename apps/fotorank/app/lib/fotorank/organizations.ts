import { prisma } from "@repo/db";
import type { AuthUser } from "../auth";

export type UserOrganization = {
  id: string;
  name: string;
  slug: string;
  role: string;
};

/**
 * Obtiene las organizaciones a las que pertenece el usuario (solo ACTIVE).
 */
export async function getUserOrganizations(userId: number): Promise<UserOrganization[]> {
  const members = await prisma.contestOrganizationMember.findMany({
    where: {
      userId,
      status: "ACTIVE",
    },
    include: {
      organization: true,
    },
  });

  return members.map((m) => ({
    id: m.organization.id,
    name: m.organization.name,
    slug: m.organization.slug,
    role: m.role,
  }));
}
