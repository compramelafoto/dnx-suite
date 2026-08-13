import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FotorankContestPartnerWelcome } from "../../components/partners/FotorankContestPartnerWelcome";
import { FotorankPartnerLogoMarquee } from "../../components/partners/FotorankPartnerLogoMarquee";
import {
  FOTORANK_CONTEST_MARQUEE_PLACEMENT,
  FOTORANK_CONTEST_MARQUEE_TITLE,
  loadFotorankContestMarqueeAds,
  toFotorankMarqueePublicItems,
} from "../../lib/fotorank/partners/contest-marquee";
import {
  loadFotorankContestWelcomeAd,
  toFotorankContestWelcomePublicPayload,
} from "../../lib/fotorank/partners/contest-welcome";
import { getPublicContestLandingBySlug } from "../../lib/fotorank/publicContestLanding";
import { ContestPublicLanding } from "./ContestPublicLanding";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await getPublicContestLandingBySlug(slug);
  if (!data) return { title: "Concurso | FotoRank" };
  const ogImage =
    data.contest.coverImageUrl ||
    (slug === "santa-fe-en-foco"
      ? "/contest-assets/santa-fe-en-foco/hero/hero-desktop.jpg"
      : null);

  return {
    title: `${data.contest.title} · ${data.organization.name}`,
    description: data.contest.shortDescription ?? data.organization.shortDescription ?? undefined,
    alternates: {
      canonical: `https://fotorank.com/concursos/${slug}`,
    },
    ...(ogImage
      ? {
          openGraph: { images: [{ url: ogImage }] },
          twitter: { images: [ogImage] },
        }
      : {}),
  };
}

export default async function ContestPublicPage({ params }: Props) {
  const { slug } = await params;
  const data = await getPublicContestLandingBySlug(slug);
  if (!data) notFound();

  // getPublicContestLandingBySlug ya exige visibility=PUBLIC + PUBLISHED|ACTIVE.
  const pathname = `/concursos/${data.contest.slug}`;
  const [welcomeAd, contestMarqueeAds] = await Promise.all([
    loadFotorankContestWelcomeAd({
      contestId: data.contest.id,
      pathname,
      publicLandingAllowed: true,
    }),
    loadFotorankContestMarqueeAds({
      contestId: data.contest.id,
      pathname,
      publicLandingAllowed: true,
    }),
  ]);
  const welcomePayload = welcomeAd ? toFotorankContestWelcomePublicPayload(welcomeAd) : null;
  const contestMarqueeItems = toFotorankMarqueePublicItems(contestMarqueeAds);

  // Landing public-ui intacta; welcome como sibling overlay; marquee DNX tras sponsors institucionales.
  // Flag OFF / sin campaña: no montar wrappers cliente (cero UI, cero chunk innecesario).
  return (
    <>
      <ContestPublicLanding
        data={data}
        brandMarquee={
          contestMarqueeItems.length > 0 ? (
            <FotorankPartnerLogoMarquee
              title={FOTORANK_CONTEST_MARQUEE_TITLE}
              titleId="contest-brand-marquee-title"
              placementKey={FOTORANK_CONTEST_MARQUEE_PLACEMENT}
              items={contestMarqueeItems}
              sectionId="dnx-sponsors"
            />
          ) : null
        }
      />
      {welcomePayload ? <FotorankContestPartnerWelcome ad={welcomePayload} /> : null}
    </>
  );
}
