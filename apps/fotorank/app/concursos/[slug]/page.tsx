import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  parsePublicPageVisualJson,
  publicPageVisualToThemePartial,
  resolveContestVisualTheme,
} from "../../lib/fotorank/contest-visual";
import { loadContestPublicPartnerGroups } from "../../lib/fotorank/partners/public-groups";
import { getPublicContestLandingBySlug } from "../../lib/fotorank/publicContestLanding";
import { ContestPublicLanding } from "./ContestPublicLanding";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await getPublicContestLandingBySlug(slug);
  if (!data) return { title: "Concurso | FotoRank" };

  const theme = resolveContestVisualTheme(
    slug,
    publicPageVisualToThemePartial(parsePublicPageVisualJson(data.contest.publicPageVisualJson)),
    {
      coverImageUrl: data.contest.coverImageUrl,
      organizerLogoUrl: data.organization.logoUrl,
      contestTitle: data.contest.title,
      organizerName: data.organization.name,
    },
  );
  const social = theme.presentation.social;
  const hero = theme.presentation.hero.desktop ?? theme.presentation.hero.mobile;
  const ogImage = social ?? hero;

  return {
    title: `${data.contest.title} · ${data.organization.name}`,
    description: data.contest.shortDescription ?? data.organization.shortDescription ?? undefined,
    alternates: {
      canonical: `https://fotorank.com/concursos/${slug}`,
    },
    ...(ogImage
      ? {
          openGraph: {
            images: [{ url: ogImage.url, alt: ogImage.alt }],
          },
          twitter: {
            images: [ogImage.url],
          },
        }
      : {}),
  };
}

export default async function ContestPublicPage({ params }: Props) {
  const { slug } = await params;
  const data = await getPublicContestLandingBySlug(slug);
  if (!data) notFound();
  const partnerGroups = await loadContestPublicPartnerGroups(data.contest.id);
  return <ContestPublicLanding data={data} partnerGroups={partnerGroups} />;
}
