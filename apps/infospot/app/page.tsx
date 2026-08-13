import type { Metadata } from "next";
import { HomeHeroSlider } from "@/components/home";
import { NoticiasIndex, NOTICIAS_PAGE_SIZE, parseNoticiasPage } from "@/components/editorial/noticias-index";
import { getCategories, getPublishedArticles } from "@/lib/articles";
import { getCachedHomepageCore } from "@/lib/distribution";
import { loadInfospotAds } from "@/lib/partners-ads";
import { PartnerAdsSlot } from "@/components/partners/PartnerAdsSlot";
import { PartnerAdsWelcome } from "@/components/partners/PartnerAdsWelcome";
import { PartnerLogoMarquee } from "@repo/design-system/components/partners";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    absolute: "Info Spot — Donde nacen los eventos",
  },
  description:
    "Últimas noticias y coberturas de eventos deportivos, culturales y sociales. Info Spot, medio digital argentino.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Info Spot — Donde nacen los eventos",
    description:
      "Últimas noticias y coberturas de eventos deportivos, culturales y sociales. Info Spot, medio digital argentino.",
    images: [
      {
        url: "/brand/og-default.png",
        width: 1200,
        height: 630,
        alt: "Info Spot",
      },
    ],
  },
};

type Props = {
  searchParams: Promise<{
    page?: string;
    lat?: string;
    lng?: string;
    radio?: string;
  }>;
};

export default async function HomePage({ searchParams }: Props) {
  const params = await searchParams;
  const page = parseNoticiasPage(params.page);
  const skip = (page - 1) * NOTICIAS_PAGE_SIZE;

  const [core, articles, categories] = await Promise.all([
    getCachedHomepageCore().catch((err) => {
      console.error("[infospot/home] core unavailable:", err);
      return { banner: [] as Awaited<ReturnType<typeof getCachedHomepageCore>>["banner"] };
    }),
    getPublishedArticles({ take: NOTICIAS_PAGE_SIZE + 1, skip }),
    getCategories(),
  ]);

  const banners = page === 1 ? core.banner : [];
  const hasNext = articles.length > NOTICIAS_PAGE_SIZE;
  const visible = hasNext ? articles.slice(0, NOTICIAS_PAGE_SIZE) : articles;

  const audience = { countryCode: "AR" as const };

  const [welcomeAds, homeTopAds, homeInlineAds, marqueeAds] = await Promise.all([
    loadInfospotAds("INFOSPOT_HOME_WELCOME", { audience }),
    loadInfospotAds("INFOSPOT_HOME_TOP", { audience }),
    loadInfospotAds("INFOSPOT_HOME_INLINE", { audience }),
    loadInfospotAds("INFOSPOT_HOME_MARQUEE", { audience }),
  ]);

  return (
    <>
      <PartnerAdsWelcome ad={welcomeAds[0] ?? null} />
      <PartnerAdsSlot ads={homeTopAds} variant="banner" label="Publicidad" />
      {banners.length > 0 ? <HomeHeroSlider items={banners} /> : null}
      <NoticiasIndex
        articles={visible}
        categories={categories}
        page={page}
        hasNext={hasNext}
        showPageHeader={banners.length === 0}
      />
      <PartnerAdsSlot
        ads={homeInlineAds}
        variant="card"
        label="Publicidad"
        placementKey="INFOSPOT_HOME_INLINE"
      />
      {marqueeAds.length > 0 ? (
        <section aria-label="Nos acompañan" className="space-y-6 py-10">
          <h2 className="text-center text-lg font-semibold tracking-tight">Nos acompañan</h2>
          <PartnerLogoMarquee
            aria-label="Sponsors"
            items={marqueeAds.map((ad) => ({
              id: ad.creativeId,
              name: ad.partnerName,
              logoUrl: ad.imageUrl ?? null,
              href: ad.href ?? null,
              campaignId: ad.campaignId,
              creativeId: ad.creativeId,
              placementKey: "INFOSPOT_HOME_MARQUEE",
            }))}
          />
        </section>
      ) : null}
    </>
  );
}
