import type { Metadata } from "next";
import { notFound } from "next/navigation";
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
  return <ContestPublicLanding data={data} />;
}
