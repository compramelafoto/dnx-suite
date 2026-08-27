import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FotorankContestPartnerWelcome } from "../../components/contest-public/FotorankContestPartnerWelcome";
import { resolveContestVisualTheme } from "../../lib/fotorank/contest-visual";
import { isSantaFeEnFocoSlug } from "../../lib/fotorank/contest-visual/santa-fe-en-foco";
import {
  loadFotorankContestWelcomeAd,
  toFotorankContestWelcomePublicPayload,
} from "../../lib/fotorank/partners/contest-welcome";
import { getPublicContestLandingBySlug } from "../../lib/fotorank/publicContestLanding";
import { resolveManagedContestMedia } from "../../lib/fotorank/contest-media";
import { getPublicContestCardBySlug, parseUpcomingConfig } from "../../lib/fotorank/upcoming/service";
import { getMyContestInterestAction } from "../../actions/contest-interest";
import { UpcomingContestLanding } from "../../components/contest-upcoming/UpcomingContestLanding";
import { prisma } from "@repo/db";
import { ContestPublicLanding } from "./ContestPublicLanding";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await getPublicContestLandingBySlug(slug);
  if (!data) return { title: "Concurso | FotoRank" };

  /**
   * Imágenes cargadas desde el administrador. En absoluto porque las redes no
   * resuelven rutas relativas al generar la vista previa del enlace.
   */
  const managed = await resolveManagedContestMedia(data.contest.id, { absolute: true });

  const theme = resolveContestVisualTheme(slug, undefined, {
    coverImageUrl: data.contest.coverImageUrl,
    organizerLogoUrl: data.organization.logoUrl,
    contestTitle: data.contest.title,
    organizerName: data.organization.name,
    managed,
  });
  const social = theme.presentation.social;

  /**
   * Imagen para compartir: el manifiesto (`social`) es la fuente primaria, pero
   * hoy SFEF tiene `social.file = null`, así que sin fallback quedaría sin OG.
   * 615df551 resolvía eso apuntando al banner del hero; se conserva ese fallback
   * detrás del sistema de assets en vez de reemplazarlo.
   */
  const ogImage =
    social?.url ??
    data.contest.coverImageUrl ??
    (isSantaFeEnFocoSlug(slug) ? "/contest-assets/santa-fe-en-foco/hero/hero-desktop.jpg" : null);
  const ogAlt = social?.alt ?? data.contest.title;

  return {
    title: `${data.contest.title} · ${data.organization.name}`,
    description: data.contest.shortDescription ?? data.organization.shortDescription ?? undefined,
    // canonical: preservado de 615df551 (mejora SEO, no específica de SFEF).
    alternates: {
      canonical: `https://fotorank.com/concursos/${slug}`,
    },
    ...(ogImage
      ? {
          openGraph: { images: [{ url: ogImage, alt: ogAlt }] },
          twitter: { images: [ogImage] },
        }
      : {}),
  };
}

export default async function ContestPublicPage({ params }: Props) {
  const { slug } = await params;
  const data = await getPublicContestLandingBySlug(slug);

  if (!data) {
    // Un concurso en fase "PRÓXIMAMENTE" todavía no tiene landing de inscripción,
    // pero sí una página pública de convocatoria con el botón "Notificarme".
    const card = await getPublicContestCardBySlug(slug);
    if (card && card.status === "UPCOMING") {
      const contest = await prisma.fotorankContest.findUnique({
        where: { id: card.id },
        select: { rulesData: true, registrationOpensAt: true, timezone: true, prizesSummary: true },
      });
      const config = parseUpcomingConfig(contest?.rulesData ?? null);
      const interest = await getMyContestInterestAction(card.id);

      const tz = contest?.timezone ?? "America/Argentina/Buenos_Aires";
      const fmt = (d: Date | null | undefined) =>
        d
          ? d.toLocaleDateString("es-AR", {
              day: "numeric",
              month: "long",
              year: "numeric",
              timeZone: tz,
            })
          : null;
      const cutoff = config.interestBenefitCutoffAt
        ? new Date(config.interestBenefitCutoffAt)
        : null;

      /** Imágenes cargadas desde el administrador para este concurso próximo. */
      const upcomingManaged = await resolveManagedContestMedia(card.id);

      return (
        <UpcomingContestLanding
          card={card}
          managed={upcomingManaged}
          interest={
            interest
              ? { status: interest.status, benefitEligible: interest.benefitEligible }
              : null
          }
          brief={config.brief ?? null}
          opensAtLabel={fmt(contest?.registrationOpensAt)}
          benefitCutoffLabel={fmt(cutoff)}
          prizeLabel={
            // La franja de datos necesita una etiqueta corta, no el párrafo completo.
            contest?.prizesSummary?.trim()
              ? contest.prizesSummary.trim().split(/[.,]/)[0]!.slice(0, 60)
              : null
          }
        />
      );
    }
    notFound();
  }

  // getPublicContestLandingBySlug ya exige visibility=PUBLIC + PUBLISHED|ACTIVE.
  const pathname = `/concursos/${data.contest.slug}`;
  const welcomeAd = await loadFotorankContestWelcomeAd({
    contestId: data.contest.id,
    pathname,
    publicLandingAllowed: true,
  });
  const welcomePayload = welcomeAd ? toFotorankContestWelcomePublicPayload(welcomeAd) : null;

  /**
   * Banner cargado desde el administrador. Relativo: lo consume el navegador de
   * quien visita, no una red social, así que no hace falta URL absoluta.
   */
  const landingManaged = await resolveManagedContestMedia(data.contest.id);

  // Partners institucionales: partnerGroups=[] intacto (no activar ContestPartnersSection).
  return (
    <>
      <ContestPublicLanding
        data={data}
        partnerGroups={[]}
        managedBanner={landingManaged.banner ?? null}
      />
      <FotorankContestPartnerWelcome ad={welcomePayload} />
    </>
  );
}
