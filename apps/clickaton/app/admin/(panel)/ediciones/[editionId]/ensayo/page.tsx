import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { adminRoutes } from "@/config/admin/navigation";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { prisma } from "@/lib/admin/db";
import { RehearsalClient } from "./RehearsalClient";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ editionId: string }> };

/**
 * Ensayo de edición: chequeo de configuración y simulación del recorrido de un
 * participante. Herramienta de administración, nunca visible al público.
 */
export default async function EditionRehearsalPage({ params }: Props) {
  const { editionId } = await params;
  await requireClickatonAdmin({ returnTo: `/admin/ediciones/${editionId}/ensayo` });

  const edition = await prisma.clickatonEdition.findUnique({
    where: { id: editionId },
    select: { id: true, name: true, slug: true, timezone: true },
  });
  if (!edition) notFound();

  return (
    <div className="min-w-0 space-y-8">
      <AdminPageHeader
        title="Ensayo de la edición"
        description="Revisá que esté todo configurado y probá el recorrido completo de un participante sin tocar datos reales."
        breadcrumbs={[
          { label: "Ediciones", href: adminRoutes.editions },
          { label: edition.name, href: `${adminRoutes.editions}/${edition.id}` },
          { label: "Ensayo" },
        ]}
      />

      <RehearsalClient
        editionId={edition.id}
        editionName={edition.name}
        editionSlug={edition.slug}
        timezone={edition.timezone ?? "America/Argentina/Buenos_Aires"}
      />
    </div>
  );
}
