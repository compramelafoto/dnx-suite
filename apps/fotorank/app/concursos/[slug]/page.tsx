import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FotorankContestPartnerWelcome } from "../../components/contest-public/FotorankContestPartnerWelcome";
import { resolveContestVisualTheme } from "../../lib/fotorank/contest-visual";
import {
  loadFotorankContestWelcomeAd,
  toFotorankContestWelcomePublicPayload,
} from "../../lib/fotorank/partners/contest-welcome";
import { getPublicContestLandingBySlug } from "../../lib/fotorank/publicContestLanding";
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

  const theme = resolveContestVisualTheme(slug, undefined, {
    coverImageUrl: data.contest.coverImageUrl,
    organizerLogoUrl: data.organization.logoUrl,
    contestTitle: data.contest.title,
    organizerName: data.organization.name,
  });
  const social = theme.presentation.social;

  return {
    title: `${data.contest.title} · ${data.organization.name}`,
    description: data.contest.shortDescription ?? data.organization.shortDescription ?? undefined,
    ...(social
      ? {
          openGraph: {
            images: [{ url: social.url, alt: social.alt }],
          },
          twitter: {
            images: [social.url],
          },
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
        select: { rulesData: true },
      });
      const config = parseUpcomingConfig(contest?.rulesData ?? null);
      const interest = await getMyContestInterestAction(card.id);
      return (
        <UpcomingContestLanding
          card={card}
          interest={
            interest
              ? { status: interest.status, benefitEligible: interest.benefitEligible }
              : null
          }
          brief={config.brief ?? null}
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

  // Partners institucionales: partnerGroups=[] intacto (no activar ContestPartnersSection).
  return (
    <>
      <ContestPublicLanding data={data} partnerGroups={[]} />
      <FotorankContestPartnerWelcome ad={welcomePayload} />
    </>
  );
}
