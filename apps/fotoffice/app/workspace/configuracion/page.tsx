import Link from "next/link";
import { prisma } from "@repo/db";
import { requireAuth } from "@/lib/auth";
import { requireOwnWorkspace } from "@/lib/entrada/require-own-workspace";
import { normalizeFotofficeOrganizationType } from "@/lib/onboarding-constants";
import { canManageWorkspaceSettings } from "@/lib/workspace-settings-access";
import { WorkspaceSettingsForm } from "./settings-form";
import { EmailSignaturePreview } from "@/components/communications/email-signature-preview";
import { TestEmailPanel } from "@/components/communications/test-email-panel";
import { toEmailSignatureData } from "@/lib/communications/workspace-signature";
import { getWorkspaceCollectionStatus } from "@/lib/payments/connect/status";
import { collectionCopy } from "@/lib/payments/connect/messages";
import { loadPersonVocabulary } from "@/lib/vocabulario/load";

export default async function WorkspaceSettingsPage() {
  const user = await requireAuth();
  const ensured = await requireOwnWorkspace(user);

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
  // Estado de cobros, para que el acceso diga si hace falta hacer algo.
  const cobros = await getWorkspaceCollectionStatus(ensured.workspaceId);
  const cobrosCopy = collectionCopy(cobros.status);
  // El acceso a Palabras muestra la que rige hoy: sin eso, entrar es la única forma de saber
  // si alguien ya la cambió.
  const vocabulario = await loadPersonVocabulary(ensured.workspaceId);

  return (
    <div className="space-y-8 max-w-xl">
      {/*
        Acceso a Cobros. Va arriba y siempre visible: si la institución no conectó su cuenta
        no puede cobrar nada, y esa es la primera cosa que necesita resolver.
      */}
      <Link
        href="/workspace/configuracion/cobros"
        className="fo-card flex items-center justify-between gap-4 p-4 transition hover:border-[var(--fo-accent,#1d4ed8)]"
      >
        <span className="space-y-0.5">
          <span className="block text-sm font-semibold">Cobros</span>
          <span
            className={
              "block text-xs " +
              (cobros.canCharge ? "text-[var(--fo-success)]" : "text-[var(--fo-danger)]")
            }
          >
            {cobrosCopy.title}
          </span>
        </span>
        <span className="text-sm text-[var(--fo-accent,#1d4ed8)]">Ver →</span>
      </Link>

      {/*
        Acceso a las palabras de la institución. Va acá y no adentro del módulo: la palabra se
        usa en el menú, en el portal y en varios módulos a la vez, así que es del workspace.
      */}
      <Link
        href="/workspace/configuracion/palabras"
        className="fo-card flex items-center justify-between gap-4 p-4 transition hover:border-[var(--fo-accent,#1d4ed8)]"
      >
        <span className="space-y-0.5">
          <span className="block text-sm font-semibold">Las palabras de tu institución</span>
          <span className="block text-xs text-[var(--fo-muted)]">
            Hoy a la gente de tu padrón le decís {vocabulario.plural}.
          </span>
        </span>
        <span className="text-sm text-[var(--fo-accent,#1d4ed8)]">Ver →</span>
      </Link>

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
      {/* Solo OWNER/ADMIN. La server action vuelve a verificarlo: esto es presentación. */}
      {canEdit ? <TestEmailPanel /> : null}
    </div>
  );
}
