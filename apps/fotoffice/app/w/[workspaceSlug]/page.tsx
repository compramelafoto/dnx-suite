import { notFound } from "next/navigation";
import { prisma } from "@repo/db";
import { loadPublicSite } from "@/lib/website/public-site";
import { loadWebsiteDynamicData } from "@/lib/website/dynamic-data.server";
import { WebsitePageRenderer } from "@/components/website/render/website-page-renderer";
import { PresupuestoLanding } from "./presupuesto-landing";
import { loadActivePlacement } from "@/lib/sponsors/placements";
import { SponsorLogoMarquee } from "@/components/sponsors/logo-marquee";

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
    // Los bloques dinámicos (hoy, "Últimos artículos") leen su contenido acá, al dibujar: no
    // viven en la versión publicada, así un artículo nuevo aparece sin volver a publicar.
    const [dynamicData, sponsors] = await Promise.all([
      loadWebsiteDynamicData(site, site.homeBlocks),
      // La franja de sponsors va al final de la portada, antes del pie. Si el módulo está apagado
      // o DNX Partners no responde, viene vacía y no se dibuja.
      loadActivePlacement(site.workspaceId, "FOTOFFICE_PUBLIC_MARQUEE"),
    ]);
    return (
      <main>
        <WebsitePageRenderer blocks={site.homeBlocks} colors={site.colors} designPresets={site.designPresets} dynamicData={dynamicData} />
        <SponsorLogoMarquee sponsors={sponsors} className="mx-auto max-w-6xl px-4" />
      </main>
    );
  }

  const form = await prisma.serviceLeadForm.findFirst({
    where: { workspaceId: site.workspaceId, slug: "general", isActive: true },
    select: { id: true, slug: true, title: true, description: true, configJson: true },
  });

  return <PresupuestoLanding workspaceSlug={workspaceSlug} commercialName={site.commercialName} form={form} />;
}
