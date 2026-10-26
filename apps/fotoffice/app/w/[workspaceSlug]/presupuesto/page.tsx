import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WebsitePageRenderer } from "@/components/website/render/website-page-renderer";
import { SERVICE_LEADS_MODULE_KEY } from "@/lib/service-leads/constants";
import { PRESUPUESTO_PAGE_LABEL } from "@/lib/website/constants";
import { loadWebsiteDynamicData } from "@/lib/website/dynamic-data.server";
import { bloqueDePaginaPresupuesto } from "@/lib/website/inquiry-form";
import { loadPublicSite } from "@/lib/website/public-site";

type Props = {
  params: Promise<{ workspaceSlug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

/**
 * «Pedí tu presupuesto»: el formulario de presupuesto (INQUIRY_FORM, config por omisión) a página
 * completa, dentro del armazón del sitio. Es la página del módulo Consultas: con el módulo apagado
 * no existe (404) y no entra al menú (`PUBLIC_MODULE_PAGES`).
 *
 * Convive con `presupuesto/[token]` (el presupuesto que se le manda a cada cliente): en Next una
 * `page.tsx` y un segmento dinámico hijo son rutas distintas, `/presupuesto` y `/presupuesto/<token>`.
 *
 * `?categoria=<id>` preelige una categoría (por ejemplo, desde el botón de una sección); si no es
 * una categoría ofrecida, el formulario la ignora.
 */
export default async function PresupuestoPage({ params, searchParams }: Props) {
  const { workspaceSlug } = await params;
  const site = await loadPublicSite(workspaceSlug);
  if (!site || !site.enabledModuleKeys.has(SERVICE_LEADS_MODULE_KEY)) notFound();

  const blocks = [bloqueDePaginaPresupuesto()];
  const dynamicData = await loadWebsiteDynamicData(site, blocks);
  const pedida = (await searchParams).categoria;
  const categoria = Array.isArray(pedida) ? pedida[0] : pedida;
  if (dynamicData.inquiry && categoria && categoria.length <= 100) {
    dynamicData.inquiry = { ...dynamicData.inquiry, categoriaPreelegida: categoria };
  }

  return (
    <main>
      <WebsitePageRenderer blocks={blocks} colors={site.colors} designPresets={site.designPresets} dynamicData={dynamicData} />
    </main>
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { workspaceSlug } = await params;
  const site = await loadPublicSite(workspaceSlug);
  if (!site || !site.enabledModuleKeys.has(SERVICE_LEADS_MODULE_KEY)) return {};
  return { title: `${PRESUPUESTO_PAGE_LABEL} · ${site.commercialName}` };
}
