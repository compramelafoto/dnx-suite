import { prisma } from "@repo/db";
import { requireAuth } from "@/lib/auth";
import { ensureFotofficeWorkspaceForUser } from "@/lib/ensure-workspace";
import { normalizeFotofficeOrganizationType } from "@/lib/onboarding-constants";
import { canManageWorkspaceSettings } from "@/lib/workspace-settings-access";
import { WorkspaceSettingsForm } from "./settings-form";
import { EmailSignaturePreview } from "@/components/communications/email-signature-preview";
import { toEmailSignatureData } from "@/lib/communications/workspace-signature";

export default async function WorkspaceSettingsPage() {
  const user = await requireAuth();
  const ensured = await ensureFotofficeWorkspaceForUser({
    userId: user.id,
    email: user.email,
    name: user.name,
  });

  const [branding, profile, membership, workspace] = await Promise.all([
    prisma.fotofficeWorkspaceBranding.findUnique({
      where: { workspaceId: ensured.workspaceId },
    }),
    prisma.fotofficePhotographerProfile.findUnique({ where: { userId: user.id } }),
    prisma.workspaceMembership.findUnique({
      where: { userId_workspaceId: { userId: user.id, workspaceId: ensured.workspaceId } },
      select: { role: true },
    }),
    prisma.workspace.findUnique({
      where: { id: ensured.workspaceId },
      select: { name: true },
    }),
  ]);
  const canEdit = canManageWorkspaceSettings(membership?.role);

  return (
    <div className="space-y-8 max-w-xl">
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--fo-text)]">
          Configuración del negocio
        </h1>
        <p className="text-sm text-[var(--fo-muted)] leading-relaxed">
          El logo de FotOffice es la marca del producto. Acá editás los datos de{" "}
          <strong className="font-medium text-[var(--fo-text)]">tu</strong> negocio — nombre, slug
          público, logo, portada, contacto y ubicación. Estos datos son del workspace y se usan en
          todos sus módulos, no solo en Cursos.
        </p>
        {!canEdit ? (
          <p className="text-sm text-[var(--fo-muted)] leading-relaxed" role="status">
            Tenés acceso de solo lectura a esta pantalla.
          </p>
        ) : null}
      </div>
      <WorkspaceSettingsForm
        canEdit={canEdit}
        initial={{
          commercialName: branding?.commercialName ?? "",
          publicSlug: branding?.publicSlug ?? "",
          contactEmail: branding?.contactEmail ?? user.email,
          phone: branding?.phone ?? profile?.phone ?? "",
          whatsapp: branding?.whatsapp ?? "",
          city: branding?.city ?? "",
          province: branding?.province ?? "",
          country: branding?.country ?? "",
          website: branding?.website ?? "",
          instagram: branding?.instagram ?? "",
          emailSignatureNote: branding?.emailSignatureNote ?? "",
          activityType: normalizeFotofficeOrganizationType(branding?.activityType),
          specialties: branding?.specialties ?? [],
          logoUrl: branding?.logoUrl ?? null,
          coverImageUrl: branding?.coverImageUrl ?? null,
          displayName: profile?.displayName ?? user.name ?? "",
        }}
      />
      {canEdit ? (
        <EmailSignaturePreview
          data={toEmailSignatureData(
            {
              commercialName: branding?.commercialName ?? null,
              logoUrl: branding?.logoUrl ?? null,
              contactEmail: branding?.contactEmail ?? null,
              phone: branding?.phone ?? null,
              whatsapp: branding?.whatsapp ?? null,
              instagram: branding?.instagram ?? null,
              website: branding?.website ?? null,
              city: branding?.city ?? null,
              accentColor: branding?.accentColor ?? null,
              emailSignatureNote: branding?.emailSignatureNote ?? null,
            },
            workspace?.name ?? "",
          )}
        />
      ) : null}
    </div>
  );
}
