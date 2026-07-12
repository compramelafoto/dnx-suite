import { getPublicEditorialCoverageByArticleSlug, getPublicEventCoverageBundle } from "../public-coverage/resolver";

async function main() {
  const c = await getPublicEditorialCoverageByArticleSlug("smoke-e11-article-c", {
    bypassCache: true,
  });
  const d = await getPublicEditorialCoverageByArticleSlug("smoke-e11-article-d", {
    bypassCache: true,
  });
  const e = await getPublicEditorialCoverageByArticleSlug("smoke-e11-article-e", {
    bypassCache: true,
  });
  const evA = await getPublicEventCoverageBundle("smoke-e11-event-a");
  const evC = await getPublicEventCoverageBundle("smoke-e11-event-c");

  console.log(
    JSON.stringify(
      {
        C: c && {
          cover: Boolean(c.coverPhoto?.src),
          gallery: c.galleryPhotos.length,
          photographers: c.photographers.length,
          albums: c.albums.length,
          cta: c.commercialAvailability.canShowPurchaseCta,
        },
        D: d && {
          cover: Boolean(d.coverPhoto?.src),
          albums: d.albums.length,
          cta: d.commercialAvailability.canShowPurchaseCta,
        },
        E: e && {
          coverUnavailable: e.coverPhoto?.unavailable ?? "no-cover",
          revoked: e.coverPhoto?.revoked,
          src: e.coverPhoto?.src,
        },
        eventA: evA && {
          temporal: evA.temporalLabel,
          join: Boolean(evA.joinHref),
          seeking: evA.seekingPhotographers,
        },
        eventC: evC && {
          albums: evC.albums.length,
          articles: evC.relatedArticles.length,
          photographers: evC.photographers.length,
        },
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
