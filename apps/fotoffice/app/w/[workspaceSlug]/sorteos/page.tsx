import { notFound, redirect } from "next/navigation";
import { prisma } from "@repo/db";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { RAFFLES_MODULE_KEY } from "@/lib/raffles/constants";
import { findFeaturedPublicRaffleId } from "@/lib/raffles/public";

export const dynamic = "force-dynamic";

/**
 * La dirección corta para compartir: `/w/<institución>/sorteos` lleva al sorteo abierto, o al
 * último que se hizo. Así el enlace de la biografía de Instagram no hay que cambiarlo cada mes.
 */
export default async function SorteosPublicosPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const branding = await prisma.fotofficeWorkspaceBranding.findUnique({
    where: { publicSlug: workspaceSlug },
    select: { workspaceId: true },
  });
  if (!branding) notFound();
  if (!(await isModuleEnabledForWorkspace(branding.workspaceId, RAFFLES_MODULE_KEY))) notFound();

  const id = await findFeaturedPublicRaffleId(branding.workspaceId);
  if (!id) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold">Sorteos</h1>
        <p className="mt-2 text-[var(--fo-muted)]">Todavía no hay ningún sorteo anunciado.</p>
      </main>
    );
  }
  redirect(`/w/${workspaceSlug}/sorteos/${id}`);
}
