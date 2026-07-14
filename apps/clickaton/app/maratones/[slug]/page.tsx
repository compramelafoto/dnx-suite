import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SimpleBreadcrumb } from "@/components/content/SimpleBreadcrumb";
import { MarathonDetailView } from "@/components/marathon/MarathonDetailView";
import { routes } from "@/config/navigation";
import { getMarathonBySlug, getMarathonSlugs } from "@/lib/marathons";
import { buildPageMetadata } from "@/lib/seo";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return getMarathonSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const marathon = getMarathonBySlug(slug);
  if (!marathon) {
    return buildPageMetadata({
      title: "Maratón no encontrada",
      description: "La edición solicitada no está disponible.",
      path: `/maratones/${slug}`,
      noIndex: true,
    });
  }

  return buildPageMetadata({
    title: marathon.isDemo
      ? `${marathon.name} — ficha técnica`
      : `${marathon.name} — ${marathon.city}`,
    description: marathon.shortDescription,
    path: `/maratones/${marathon.slug}`,
    noIndex: true,
  });
}

export default async function MarathonDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const marathon = getMarathonBySlug(slug);
  if (!marathon) notFound();

  return (
    <>
      <SimpleBreadcrumb
        items={[
          { label: "Inicio", href: routes.home },
          { label: "Maratones", href: routes.marathons },
          { label: marathon.isDemo ? "Demo técnica" : marathon.name },
        ]}
      />
      <MarathonDetailView marathon={marathon} />
    </>
  );
}
