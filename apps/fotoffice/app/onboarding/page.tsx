import { redirect } from "next/navigation";
import { prisma } from "@repo/db";
import { requireAuth } from "@/lib/auth";
import { ensureFotofficeWorkspaceForUser } from "@/lib/ensure-workspace";
import { normalizeFotofficeOrganizationType } from "@/lib/onboarding-constants";
import { OnboardingWizard } from "./onboarding-wizard";

export default async function OnboardingPage() {
  const user = await requireAuth();
  const ensured = await ensureFotofficeWorkspaceForUser({
    userId: user.id,
    email: user.email,
    name: user.name,
  });

  if (ensured.onboardingCompleted) {
    redirect("/workspace");
  }

  const [profile, branding] = await Promise.all([
    prisma.fotofficePhotographerProfile.findUnique({ where: { userId: user.id } }),
    prisma.fotofficeWorkspaceBranding.findUnique({ where: { workspaceId: ensured.workspaceId } }),
  ]);

  return (
    <OnboardingWizard
      initial={{
        firstName: profile?.firstName ?? "",
        lastName: profile?.lastName ?? "",
        displayName: profile?.displayName ?? user.name ?? "",
        phone: profile?.phone ?? "",
        commercialName: branding?.commercialName ?? "",
        activityType:
          normalizeFotofficeOrganizationType(branding?.activityType) || "FREELANCE_PHOTOGRAPHER",
        city: branding?.city ?? "",
        province: branding?.province ?? "",
        country: branding?.country ?? "",
        website: branding?.website ?? "",
        instagram: branding?.instagram ?? "",
        specialties: branding?.specialties ?? [],
      }}
    />
  );
}
