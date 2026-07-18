import { prisma } from "@repo/db";
import { requireAuth } from "@/lib/auth";
import { ensureFotofficeWorkspaceForUser } from "@/lib/ensure-workspace";
import { WorkspaceSettingsForm } from "./settings-form";

export default async function WorkspaceSettingsPage() {
  const user = await requireAuth();
  const ensured = await ensureFotofficeWorkspaceForUser({
    userId: user.id,
    email: user.email,
    name: user.name,
  });

  const [branding, profile] = await Promise.all([
    prisma.fotofficeWorkspaceBranding.findUnique({
      where: { workspaceId: ensured.workspaceId },
    }),
    prisma.fotofficePhotographerProfile.findUnique({ where: { userId: user.id } }),
  ]);

  return (
    <div className="space-y-8 max-w-xl">
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--fo-text)]">
          Configuración del negocio
        </h1>
        <p className="text-sm text-[var(--fo-muted)] leading-relaxed">
          El logo de FotOffice es la marca del producto. Acá editás los datos de{" "}
          <strong className="font-medium text-[var(--fo-text)]">tu</strong> negocio.
        </p>
      </div>
      <WorkspaceSettingsForm
        initial={{
          commercialName: branding?.commercialName ?? "",
          contactEmail: branding?.contactEmail ?? user.email,
          phone: branding?.phone ?? profile?.phone ?? "",
          city: branding?.city ?? "",
          province: branding?.province ?? "",
          country: branding?.country ?? "",
          website: branding?.website ?? "",
          instagram: branding?.instagram ?? "",
          activityType: branding?.activityType ?? "independent",
          specialties: branding?.specialties ?? [],
          businessLogoUrl: branding?.logoUrl ?? "",
          displayName: profile?.displayName ?? user.name ?? "",
        }}
      />
    </div>
  );
}
