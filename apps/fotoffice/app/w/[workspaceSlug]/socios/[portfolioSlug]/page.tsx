import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@repo/db";
import { loadPersonVocabulary } from "@/lib/vocabulario/load";
import { etiquetaEspecialidad } from "@/lib/membership/specialties";
import { PORTFOLIO_PUBLIC_SEGMENT } from "@/lib/portfolio/constants";
import { loadPublicPortfolio, type PublicPortfolio } from "@/lib/portfolio/public-queries";
import { PortfolioGallery } from "@/components/public/portfolio/portfolio-gallery";

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
 * La ficha pública de una persona: su presentación, sus enlaces y su galería.
 *
 * El 404 es el mismo tanto si el slug no existe como si existe y no está publicado, a propósito:
 * quien prueba direcciones no tiene que poder distinguir una cosa de la otra.
 */
export default async function PublicPortfolioPage({ params }: Props) {
  const { workspaceSlug, portfolioSlug } = await params;
  const datos = await cargar(workspaceSlug, portfolioSlug);
  if (!datos) notFound();

  const { branding, portfolio } = datos;
  const vocabulario = await loadPersonVocabulary(branding.workspaceId);
  const volver = `/w/${workspaceSlug}/${PORTFOLIO_PUBLIC_SEGMENT}`;

  return (
    <main className="mx-auto max-w-5xl space-y-10 px-4 py-12 md:px-8 md:py-16">
      <p>
        <Link href={volver} className="text-sm underline opacity-70">
          ← Volver a {vocabulario.plural}
        </Link>
      </p>

      <header className="flex flex-col gap-6 sm:flex-row sm:items-start">
        {portfolio.profilePhotoUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={portfolio.profilePhotoUrl}
            alt={portfolio.displayName}
            width={160}
            height={160}
            className="h-28 w-28 shrink-0 rounded-full object-cover"
          />
        ) : null}

        <div className="space-y-3">
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
              {portfolio.displayName}
            </h1>
            {portfolio.businessName || portfolio.businessLogoUrl ? (
              /*
               * El logo acompaña al nombre del estudio, chico y al lado — no compite con la foto de
               * perfil ni con la obra. En un portfolio manda lo que la persona fotografió.
               *
               * Fondo blanco como en el portal: casi todos los logos son PNG con transparencia
               * hechos para fondo claro, y sobre un sitio oscuro desaparecerían.
               */
              <div className="flex min-w-0 items-center gap-2">
                {portfolio.businessLogoUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={portfolio.businessLogoUrl}
                    alt={portfolio.businessName ?? `Logo de ${portfolio.displayName}`}
                    className="h-8 w-auto max-w-28 shrink-0 rounded bg-white object-contain"
                    loading="lazy"
                  />
                ) : null}
                {portfolio.businessName ? (
                  <p className="truncate opacity-80">{portfolio.businessName}</p>
                ) : null}
              </div>
            ) : null}
          </div>

          {portfolio.specialties.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {portfolio.specialties.map((id) => (
                <li
                  key={id}
                  className="rounded-full border px-3 py-1 text-xs"
                  style={{ borderColor: "var(--wsite-text)", opacity: 0.7 }}
                >
                  {etiquetaEspecialidad(id)}
                </li>
              ))}
            </ul>
          ) : null}

          {portfolio.bio ? (
            <p className="max-w-prose whitespace-pre-line text-sm opacity-90">{portfolio.bio}</p>
          ) : null}

          <EnlacesDeContacto links={portfolio.links} />
        </div>
      </header>

      <PortfolioGallery photos={portfolio.photos} authorName={portfolio.displayName} />
    </main>
  );
}

/**
 * Los enlaces que la persona cargó. Todos con `rel="noopener noreferrer"`: son direcciones que
 * escribió alguien de afuera del equipo, y una pestaña abierta con `window.opener` vivo puede
 * redirigir la nuestra.
 */
function EnlacesDeContacto({ links }: { links: PublicPortfolio["links"] }) {
  const items: { etiqueta: string; href: string }[] = [];
  if (links.website) items.push({ etiqueta: "Sitio", href: normalizarUrl(links.website) });
  if (links.instagram)
    items.push({ etiqueta: "Instagram", href: `https://instagram.com/${limpiarUsuario(links.instagram)}` });
  if (links.tiktok)
    items.push({ etiqueta: "TikTok", href: `https://tiktok.com/@${limpiarUsuario(links.tiktok)}` });
  if (links.facebook) items.push({ etiqueta: "Facebook", href: normalizarUrl(links.facebook) });
  if (links.youtube) items.push({ etiqueta: "YouTube", href: normalizarUrl(links.youtube) });
  if (links.linkedin) items.push({ etiqueta: "LinkedIn", href: normalizarUrl(links.linkedin) });

  if (items.length === 0) return null;

  return (
    <ul className="flex flex-wrap gap-3 text-sm">
      {items.map((i) => (
        <li key={i.etiqueta}>
          <a href={i.href} target="_blank" rel="noopener noreferrer" className="underline">
            {i.etiqueta}
          </a>
        </li>
      ))}
    </ul>
  );
}

/** Quien escribe "miestudio.com" sin `https://` igual tiene que terminar en su sitio. */
function normalizarUrl(valor: string): string {
  const limpio = valor.trim();
  return /^https?:\/\//i.test(limpio) ? limpio : `https://${limpio}`;
}

/** Acepta "@usuario", "usuario" o la URL completa pegada en el campo. */
function limpiarUsuario(valor: string): string {
  return valor
    .trim()
    .replace(/^https?:\/\/(www\.)?[^/]+\//i, "")
    .replace(/^@/, "")
    .replace(/\/+$/, "");
}
