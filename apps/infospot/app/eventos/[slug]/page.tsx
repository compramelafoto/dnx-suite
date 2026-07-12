import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EditorialContainer, Section, SiteContainer } from "@/components/foundations";
import { ShareEventButton } from "@/components/events/ShareEventButton";
import {
  getPublishedEventBySlug,
  toPublicEventDetail,
} from "@/lib/events";
import { pickThematicStock } from "@/lib/editorial-stock";
import { headers } from "next/headers";
import {
  getPublicEventCoverageBundle,
} from "@/lib/public-coverage";
import { getEventTemporalState } from "@/lib/distribution/temporal";
import {
  CoverageAlbumsCommerce,
  CoveragePhotographers,
  RelatedEventCoverage,
  EventLifecycleSection,
  ContentViewTracker,
} from "@/components/public-coverage";
import { buildTrackedHref } from "@/lib/public-coverage/tracking-href";

type Props = {
  params: Promise<{ slug: string }>;
};

function formatRange(start: Date, end: Date | null) {
  const dateFmt = new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const timeFmt = new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const base = `${dateFmt.format(start)} · ${timeFmt.format(start)}`;
  if (!end) return base;
  return `${base} — ${timeFmt.format(end)}`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const row = await getPublishedEventBySlug(slug);
  if (!row) return { title: "Evento" };

  const event = toPublicEventDetail(row);
  const title = event.title;
  const locationBits = [event.publicLocation.city, event.publicLocation.province]
    .filter(Boolean)
    .join(", ");
  const description =
    event.summary ||
    (locationBits
      ? `${event.title} en ${locationBits}.`
      : event.title);
  const temporal = getEventTemporalState({
    startAt: event.startAt,
    endAt: event.endAt,
  });

  return {
    title,
    description,
    alternates: { canonical: `/eventos/${event.slug}` },
    openGraph: {
      title,
      description,
      type: "website",
      url: `/eventos/${event.slug}`,
      ...(event.coverImageUrl
        ? { images: [{ url: event.coverImageUrl, alt: event.title }] }
        : {}),
    },
    other: {
      "event:start_time": event.startAt.toISOString(),
      ...(locationBits ? { "event:location": locationBits } : {}),
      "event:status": temporal,
    },
  };
}

export default async function EventoDetailPage({ params }: Props) {
  const { slug } = await params;
  const row = await getPublishedEventBySlug(slug);
  if (!row) notFound();

  const event = toPublicEventDetail(row);
  const bundle = await getPublicEventCoverageBundle(slug);
  const temporal = getEventTemporalState({
    startAt: event.startAt,
    endAt: event.endAt,
  });
  const temporalLabel = bundle?.temporalLabel || "";
  const loc = event.publicLocation;

  const fallback = pickThematicStock(
    event.id,
    `${event.categorySlug || ""} ${event.title}`,
  );
  const image = event.coverImageUrl || fallback.src;

  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || "https";
  const shareUrl = `${proto}://${host}/eventos/${event.slug}`;

  const registrationTracked = event.registrationUrl
    ? buildTrackedHref({
        to: event.registrationUrl,
        kind: "EVENT_CLICK",
        eventId: event.id,
      })
    : null;

  const eventStatusSchema =
    temporal === "CANCELLED"
      ? "https://schema.org/EventCancelled"
      : "https://schema.org/EventScheduled";

  const jsonLdLocation =
    loc.city || loc.province || loc.venueName || loc.label
      ? {
          "@type": "Place",
          name: loc.venueName || loc.city || loc.label,
          address: {
            "@type": "PostalAddress",
            ...(loc.city ? { addressLocality: loc.city } : {}),
            ...(loc.province ? { addressRegion: loc.province } : {}),
            ...(loc.showExactAddress && loc.address
              ? { streetAddress: loc.address }
              : {}),
            addressCountry: "AR",
          },
          ...(loc.showCoordinates && loc.latitude != null && loc.longitude != null
            ? {
                geo: {
                  "@type": "GeoCoordinates",
                  latitude: loc.latitude,
                  longitude: loc.longitude,
                },
              }
            : {}),
        }
      : undefined;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    description: event.summary || event.description.slice(0, 300),
    startDate: event.startAt.toISOString(),
    ...(event.endAt ? { endDate: event.endAt.toISOString() } : {}),
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    eventStatus: eventStatusSchema,
    ...(jsonLdLocation ? { location: jsonLdLocation } : {}),
    organizer: {
      "@type": "Organization",
      name: event.organizerName,
      ...(event.organizerWebsite ? { url: event.organizerWebsite } : {}),
    },
    ...(event.coverImageUrl ? { image: [event.coverImageUrl] } : {}),
    ...(event.registrationUrl ? { url: event.registrationUrl } : {}),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ContentViewTracker kind="EVENT_VIEW" eventId={event.id} />

      <div className="relative min-h-[42vw] overflow-hidden bg-[var(--is-graphite-900)] lg:min-h-[min(52vh,520px)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image}
          alt={event.title}
          className="absolute inset-0 h-full w-full object-cover"
          loading="eager"
          draggable={false}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[color-mix(in_oklab,var(--is-graphite-950)_85%,transparent)] to-transparent" />
        <SiteContainer className="relative flex min-h-[inherit] items-end pb-10 pt-28">
          <div className="max-w-3xl space-y-3 text-[var(--is-white-0)]">
            {event.categoryName ? (
              <p className="is-eyebrow !text-[var(--is-orange-300)]">
                {event.categoryName}
              </p>
            ) : null}
            {temporalLabel ? (
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--is-orange-300)]">
                {temporalLabel}
              </p>
            ) : null}
            <h1 className="is-display-l !text-[var(--is-white-0)]">{event.title}</h1>
            <p className="text-[color-mix(in_oklab,var(--is-white-0)_85%,transparent)]">
              {formatRange(event.startAt, event.endAt)}
            </p>
          </div>
        </SiteContainer>
      </div>

      <Section spacing="lg">
        <EditorialContainer className="grid gap-12 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-8">
            {event.summary ? (
              <p className="text-lg text-[var(--is-text-secondary)] md:text-xl">
                {event.summary}
              </p>
            ) : null}
            <div className="prose prose-neutral max-w-none whitespace-pre-wrap text-[var(--is-text)]">
              {event.description}
            </div>

            {bundle && (bundle.relatedArticles.length > 0 || bundle.albums.length > 0) ? (
              <div className="mt-10 space-y-4">
                {temporal === "FINISHED" || temporal === "IN_PROGRESS" ? (
                  <h2 className="is-title-section text-2xl">Coberturas y crónicas</h2>
                ) : (
                  <h2 className="is-title-section text-2xl">Actualizaciones</h2>
                )}
                <RelatedEventCoverage
                  articles={bundle.relatedArticles}
                  articlesHeading="Noticias relacionadas"
                />
                <CoveragePhotographers photographers={bundle.photographers} />
                <CoverageAlbumsCommerce albums={bundle.albums} />
              </div>
            ) : null}
          </div>

          <aside className="space-y-8 lg:col-span-4">
            <div className="border border-[var(--is-border)] p-5">
              <p className="is-eyebrow">Dónde</p>
              <p className="mt-3 font-semibold">{loc.label}</p>
              {loc.city || loc.province || (loc.showExactAddress && loc.address) ? (
                <p className="mt-1 text-sm text-[var(--is-text-secondary)]">
                  {[
                    loc.showExactAddress ? loc.address : null,
                    loc.city,
                    loc.province,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              ) : null}
              <p className="mt-4 text-sm">
                Organiza <strong>{event.organizerName}</strong>
              </p>
              {event.organizerWebsite ? (
                <a
                  href={event.organizerWebsite}
                  rel="noopener noreferrer"
                  target="_blank"
                  className="mt-2 inline-block text-sm text-[var(--is-accent)] hover:underline"
                >
                  Sitio del organizador
                </a>
              ) : null}
            </div>

            <EventLifecycleSection
              temporalState={temporal}
              temporalLabel={temporalLabel}
              registrationHref={registrationTracked}
              joinHref={bundle?.joinHref}
              seekingPhotographers={bundle?.seekingPhotographers}
            >
              {bundle && bundle.albums.length > 0 ? (
                <CoverageAlbumsCommerce
                  albums={bundle.albums}
                  title="Comprar fotos del evento"
                />
              ) : null}
            </EventLifecycleSection>

            {!bundle?.seekingPhotographers && !event.registrationUrl ? (
              <div className="border-t border-[var(--is-border)] pt-6">
                <p className="is-eyebrow">¿Sos fotógrafo?</p>
                <p className="mt-3 text-sm text-[var(--is-text-secondary)]">
                  {temporal === "FINISHED"
                    ? "La convocatoria de este evento ya cerró."
                    : "Pronto vas a poder postularte para cubrir este evento."}
                </p>
                <Link
                  href="/contacto"
                  className="mt-4 inline-flex text-sm font-medium text-[var(--is-accent)] hover:underline"
                >
                  Quiero enterarme
                </Link>
              </div>
            ) : null}

            <ShareEventButton title={event.title} url={shareUrl} />
          </aside>
        </EditorialContainer>
      </Section>
    </>
  );
}
