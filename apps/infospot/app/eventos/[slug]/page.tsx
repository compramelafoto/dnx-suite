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
  const event = await getPublishedEventBySlug(slug);
  if (!event) return { title: "Evento" };

  const title = event.title;
  const description =
    event.summary ||
    `${event.title} en ${event.city}, ${event.province}.`;

  return {
    title,
    description,
    alternates: { canonical: `/eventos/${event.slug}` },
    openGraph: {
      title,
      description,
      type: "website",
      ...(event.coverImageUrl
        ? { images: [{ url: event.coverImageUrl, alt: event.title }] }
        : {}),
    },
  };
}

export default async function EventoDetailPage({ params }: Props) {
  const { slug } = await params;
  const row = await getPublishedEventBySlug(slug);
  if (!row) notFound();

  const event = toPublicEventDetail(row);
  const fallback = pickThematicStock(
    event.id,
    `${event.categorySlug || ""} ${event.title}`,
  );
  const image = event.coverImageUrl || fallback.src;

  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || "https";
  const shareUrl = `${proto}://${host}/eventos/${event.slug}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    description: event.summary || event.description.slice(0, 300),
    startDate: event.startAt.toISOString(),
    ...(event.endAt ? { endDate: event.endAt.toISOString() } : {}),
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    eventStatus: "https://schema.org/EventScheduled",
    location: {
      "@type": "Place",
      name: event.venueName || event.city,
      address: {
        "@type": "PostalAddress",
        addressLocality: event.city,
        addressRegion: event.province,
        ...(event.address ? { streetAddress: event.address } : {}),
        addressCountry: "AR",
      },
    },
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
          </div>

          <aside className="space-y-8 lg:col-span-4">
            <div className="border border-[var(--is-border)] p-5">
              <p className="is-eyebrow">Dónde</p>
              <p className="mt-3 font-semibold">{event.venueName || event.city}</p>
              <p className="mt-1 text-sm text-[var(--is-text-secondary)]">
                {[event.address, event.city, event.province]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
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

            {event.registrationUrl ? (
              <a
                href={event.registrationUrl}
                rel="noopener noreferrer"
                target="_blank"
                className="is-btn is-btn-solid h-11 w-full text-sm"
              >
                Inscribirme
              </a>
            ) : null}

            <ShareEventButton title={event.title} url={shareUrl} />

            <div className="border-t border-[var(--is-border)] pt-6">
              <p className="is-eyebrow">¿Sos fotógrafo?</p>
              <p className="mt-3 text-sm text-[var(--is-text-secondary)]">
                Pronto vas a poder postularte para cubrir este evento.
              </p>
              <Link
                href="/contacto"
                className="mt-4 inline-flex text-sm font-medium text-[var(--is-accent)] hover:underline"
              >
                Quiero enterarme
              </Link>
            </div>
          </aside>
        </EditorialContainer>
      </Section>
    </>
  );
}
