import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@repo/db";
import { EditorialAssistant } from "@/components/redaccion/editorial-assistant/editorial-assistant";
import { NewsroomBreadcrumbs } from "@/components/redaccion/newsroom-breadcrumbs";
import { RedaccionShell } from "@/components/redaccion/redaccion-shell";
import { getCategories } from "@/lib/articles";
import {
  buildEventCardsFromCoverages,
  clfEventToAssistantCard,
  eventStatusLabel,
  toCoverageCards,
  type AssistantEventCard,
  type AssistantIntent,
} from "@/lib/editorial-assistant";
import {
  hydrateAssistantEventsWithClfDates,
  listClfCitiesForAssistant,
  listClfEventsForAssistant,
} from "@/lib/clf-queries";
import { listCoveragesForCenter } from "@/lib/coverage";
import {
  canCreateInfoSpotArticle,
  requireInfoSpotRedaccionAccess,
} from "@/lib/infospot-access";

export const metadata: Metadata = {
  title: "Asistente Editorial",
};

type PageProps = {
  searchParams: Promise<{
    intent?: string;
    eventId?: string;
    coverageId?: string;
    coverageIds?: string;
    articleId?: string;
    mode?: string;
  }>;
};

function parseIntent(raw?: string): AssistantIntent | null {
  if (!raw) return null;
  if (
    raw === "event" ||
    raw === "coverage" ||
    raw === "independent" ||
    raw === "gallery" ||
    raw === "pending"
  ) {
    return raw;
  }
  return null;
}

export default async function AsistenteEditorialPage({ searchParams }: PageProps) {
  const access = await requireInfoSpotRedaccionAccess();
  if (!canCreateInfoSpotArticle(access.subject)) {
    notFound();
  }

  const params = await searchParams;
  const [coveragesRaw, categories] = await Promise.all([
    listCoveragesForCenter({ take: 120 }),
    getCategories(),
  ]);

  const coverageCards = toCoverageCards(coveragesRaw);
  let eventCards = buildEventCardsFromCoverages(coveragesRaw);
  let citiesFromClf: string[] = [];

  const clfDates = await hydrateAssistantEventsWithClfDates(eventCards.map((e) => e.id));
  eventCards = eventCards.map((e) => {
    const hydrated = clfDates.get(e.id);
    if (!hydrated) return e;
    const startsAt = hydrated.startsAt?.toISOString() ?? null;
    const endsAt = hydrated.endsAt?.toISOString() ?? null;
    const lat = hydrated.latitude;
    const lng = hydrated.longitude;
    return {
      ...e,
      title: hydrated.title || e.title,
      city: hydrated.city ?? e.city,
      startsAt,
      endsAt,
      statusLabel: eventStatusLabel({ startsAt, endsAt }),
      coverageCount: Math.max(e.coverageCount, hydrated.albumCount || 0),
      latitude: lat,
      longitude: lng,
      hasGeoref: lat != null && lng != null,
    };
  });

  // Próximos + recientes: más cobertura que un único take pequeño.
  try {
    const [upcoming, recent, cities] = await Promise.all([
      listClfEventsForAssistant({ take: 80, window: "upcoming" }),
      listClfEventsForAssistant({ take: 80, window: "recent" }),
      listClfCitiesForAssistant(250),
    ]);
    citiesFromClf = cities;
    const known = new Set(eventCards.map((e) => e.id));
    const extras: AssistantEventCard[] = [];
    for (const e of [...upcoming, ...recent]) {
      if (known.has(e.id)) {
        // Completar georref / ciudad si el card vino solo de cobertura.
        const idx = eventCards.findIndex((c) => c.id === e.id);
        if (idx >= 0) {
          const prev = eventCards[idx]!;
          eventCards[idx] = {
            ...prev,
            city: e.city ?? prev.city,
            latitude: e.latitude ?? prev.latitude,
            longitude: e.longitude ?? prev.longitude,
            hasGeoref:
              (e.latitude != null && e.longitude != null) || Boolean(prev.hasGeoref),
          };
        }
        continue;
      }
      known.add(e.id);
      extras.push(clfEventToAssistantCard(e));
    }
    eventCards = [...eventCards, ...extras];
  } catch {
    // CLF opcional
  }

  // Ciudades del subset + CLF (union).
  const citySet = new Set<string>(citiesFromClf);
  for (const e of eventCards) {
    if (e.city?.trim()) citySet.add(e.city.trim());
  }
  const cities = Array.from(citySet).sort((a, b) => a.localeCompare(b, "es"));

  const coverageIds = [
    ...(params.coverageId ? [params.coverageId] : []),
    ...(params.coverageIds
      ? params.coverageIds.split(",").map((s) => s.trim()).filter(Boolean)
      : []),
  ];

  // Modo agregar material: resolver coberturas del artículo
  if (params.mode === "photos" && params.articleId && coverageIds.length === 0) {
    const article = await prisma.infoSpotArticle.findUnique({
      where: { id: params.articleId },
      select: {
        clfAlbumId: true,
        coverageLinks: { select: { coverageId: true } },
      },
    });
    if (article?.coverageLinks.length) {
      coverageIds.push(...article.coverageLinks.map((l) => l.coverageId));
    } else if (article?.clfAlbumId) {
      const byAlbum = coveragesRaw.find((c) => c.clfAlbumId === article.clfAlbumId);
      if (byAlbum) coverageIds.push(byAlbum.id);
    }
  }

  const deepLink = {
    intent: parseIntent(params.intent),
    eventId: params.eventId ? Number(params.eventId) : null,
    coverageIds,
    articleId: params.articleId ?? null,
    mode: params.mode === "photos" ? ("photos" as const) : ("full" as const),
  };

  return (
    <RedaccionShell>
      <NewsroomBreadcrumbs
        items={[
          { label: "Centro Editorial", href: "/redaccion" },
          { label: "Asistente Editorial" },
        ]}
      />
      <EditorialAssistant
        bootstrap={{
          coverages: coverageCards,
          events: eventCards,
          cities,
          authorDefault: access.user.name?.trim() || access.user.email,
          categories: categories.map((c) => ({ id: c.id, name: c.name })),
        }}
        deepLink={deepLink}
      />
    </RedaccionShell>
  );
}
