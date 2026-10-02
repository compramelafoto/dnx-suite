import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@repo/db";
import { loadPersonVocabulary } from "@/lib/vocabulario/load";
import { etiquetaEspecialidad } from "@/lib/membership/specialties";
import { PORTFOLIO_PUBLIC_SEGMENT } from "@/lib/portfolio/constants";
import { loadPublicPortfolio } from "@/lib/portfolio/public-queries";
import { PortfolioShowcase } from "@/components/public/portfolio/portfolio-showcase";

type Props = { params: Promise<{ workspaceSlug: string; portfolioSlug: string }> };

async function cargar(workspaceSlug: string, portfolioSlug: string) {
  const branding = await prisma.fotofficeWorkspaceBranding.findUnique({
    where: { publicSlug: workspaceSlug },
    select: { workspaceId: true, commercialName: true },
  });
  if (!branding) return null;

  // `loadPublicPortfolio` ya verifica el módulo y las siete condiciones.
  const portfolio = await loadPublicPortfolio({
    workspaceId: branding.workspaceId,
    publicSlug: portfolioSlug,
  });
  if (!portfolio) return null;

  return { branding, portfolio };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { workspaceSlug, portfolioSlug } = await params;
  const datos = await cargar(workspaceSlug, portfolioSlug);
  if (!datos) return {};

  const { branding, portfolio } = datos;
  const especialidades = portfolio.specialties.map((id) => etiquetaEspecialidad(id)).join(", ");
  const descripcion =
    portfolio.bio?.trim() ||
    [portfolio.businessName, especialidades].filter(Boolean).join(" · ") ||
    `La obra de ${portfolio.displayName} en ${branding.commercialName}.`;

  return {
    title: `${portfolio.displayName} · ${branding.commercialName}`,
    description: descripcion.slice(0, 300),
    openGraph: {
      title: portfolio.displayName,
      description: descripcion.slice(0, 300),
      /*
       * La foto destacada, no el logo de la institución: compartir el enlace de alguien en WhatsApp
       * tiene que mostrar su obra. Es la diferencia entre compartir a una persona y compartir un
       * sitio.
       */
      images: portfolio.coverUrl ? [{ url: portfolio.coverUrl }] : undefined,
      type: "profile",
    },
  };
}

/**
 * La ficha pública de una persona.
 *
 * Todo lo que se dibuja vive en `PortfolioShowcase`, que comparte con la vista previa del portal:
 * así lo que el socio ve antes de publicar es exactamente lo que va a ver quien entre.
 *
 * El 404 es el mismo tanto si el slug no existe como si existe y no está publicado, a propósito:
 * quien prueba direcciones no tiene que poder distinguir una cosa de la otra.
 */
export default async function PublicPortfolioPage({ params }: Props) {
  const { workspaceSlug, portfolioSlug } = await params;
  const datos = await cargar(workspaceSlug, portfolioSlug);
  if (!datos) notFound();

  const vocabulario = await loadPersonVocabulary(datos.branding.workspaceId);
  const volver = `/w/${workspaceSlug}/${PORTFOLIO_PUBLIC_SEGMENT}`;

  return (
    <main className="mx-auto max-w-5xl space-y-10 px-4 py-12 md:px-8 md:py-16">
      <p>
        <Link
          href={volver}
          className="inline-flex items-center gap-1 text-sm underline opacity-70 transition-opacity hover:opacity-100"
        >
          ← Volver a {vocabulario.plural}
        </Link>
      </p>

      <PortfolioShowcase
        portfolio={datos.portfolio}
        contactHref={`${volver}/${portfolioSlug}/contacto`}
      />
    </main>
  );
}
