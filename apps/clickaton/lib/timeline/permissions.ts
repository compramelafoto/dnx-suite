import { prisma } from "@/lib/admin/db";
import { hasClickatonAdminAccess } from "@/lib/admin/access";

export const CAPABILITY_MANAGE_TIMELINE = "canManageEditionTimeline";
export const CAPABILITY_RELEASE_PROMPTS = "canReleaseEditionPrompts";

export async function hasEditionCapability(input: {
  userId: number;
  email: string;
  globalRole: string;
  editionId: string;
  capability: string;
}): Promise<boolean> {
  if (hasClickatonAdminAccess({ email: input.email, globalRole: input.globalRole })) {
    return true;
  }
  const grant = await prisma.clickatonEditionCapabilityGrant.findUnique({
    where: {
      editionId_userId_capability: {
        editionId: input.editionId,
        userId: input.userId,
        capability: input.capability,
      },
    },
    select: { id: true },
  });
  return Boolean(grant);
}
