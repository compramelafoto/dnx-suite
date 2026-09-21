import { notFound } from "next/navigation";
import { prisma } from "@repo/db";
import { loadPublicSite } from "@/lib/website/public-site";
import { WebsitePageRenderer } from "@/components/website/render/website-page-renderer";
import { PresupuestoLanding } from "./presupuesto-landing";

type Props = { params: Promise<{ workspaceSlug: string }> };

/**
 * La portada de la institución.
 *
 * Con sitio publicado, es el sitio que el dueño armó. Sin sitio publicado — porque el módulo
 * está apagado o porque nunca publicó — sigue siendo la landing de presupuesto de siempre, que
 * es lo que hay hoy en producción y lo que la gente ya comparte por WhatsApp. Ese respaldo es
 * deliberado: publicar el sitio nuevo no puede dejar sin puerta a quien todavía no lo armó.
 */
export default async function PublicWorkspaceHomePage({ params }: Props) {
  const { workspaceSlug } = await params;
  const site = await loadPublicSite(workspaceSlug);
  if (!site) notFound();

  if (site.hasPublishedSite) {
    return (
      <main>
        <WebsitePageRenderer blocks={site.homeBlocks} colors={site.colors} designPresets={site.designPresets} />
      </main>
    );
  }

  const form = await prisma.serviceLeadForm.findFirst({
    where: { workspaceId: site.workspaceId, slug: "general", isActive: true },
    select: { id: true, slug: true, title: true, description: true, configJson: true },
  });

  return <PresupuestoLanding workspaceSlug={workspaceSlug} commercialName={site.commercialName} form={form} />;
}
