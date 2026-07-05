"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import OrganizerFeaturedGalleryCard from "@/components/organizer/landing/OrganizerFeaturedGalleryCard";
import OrganizerPublicListToolbar from "@/components/organizer/landing/OrganizerPublicListToolbar";
import {
  filterPublicFeaturedGalleries,
  filterPublicLandingEvents,
  PUBLIC_PAST_EVENT_SORT_OPTIONS,
  PUBLIC_UPCOMING_EVENT_SORT_OPTIONS,
  sortPublicFeaturedGalleries,
  sortPublicLandingEvents,
  type FeaturedListSortKey,
} from "@/lib/organizer-public-landing-list";
import type {
  OrganizerPublicFeaturedGallery,
  OrganizerPublicLandingEvent,
  OrganizerPublicLandingView,
  OrganizerPublicPhotographerCard,
} from "@/lib/organizer-public-landing-server";

function ContactIcon({ children }: { children: ReactNode }) {
  return (
    <span
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#c27b3d]/20 bg-[#c27b3d]/10 text-[var(--org-primary,#c27b3d)]"
      aria-hidden
    >
      {children}
    </span>
  );
}

function IconLocation() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s7-4.5 7-11a7 7 0 10-14 0c0 6.5 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function IconMail() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16v12H4V6zm0 0l8 6 8-6" />
    </svg>
  );
}

function IconGlobe() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18" />
    </svg>
  );
}

function IconInstagram() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zm0 10.162a3.999 3.999 0 110-7.998 3.999 3.999 0 010 7.998zm6.406-11.845a1.44 1.44 0 11-2.881 0 1.44 1.44 0 012.881 0z" />
    </svg>
  );
}

function IconWhatsApp() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  );
}

function contactLinkClass() {
  return "text-[var(--org-primary,#c27b3d)] font-medium hover:underline break-words";
}

function normalizeExternalUrl(url: string): string {
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function normalizeInstagramUrl(raw: string): string {
  const trimmed = raw.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("@")) return `https://instagram.com/${trimmed.slice(1)}`;
  return `https://instagram.com/${trimmed}`;
}

function ContactRow({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <li className="org-contact-row flex w-auto max-w-full items-start gap-3 sm:gap-4">
      <ContactIcon>{icon}</ContactIcon>
      <div className="org-contact-row__copy ds-content-container flex-1 text-left">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 m-0 mb-0.5 leading-snug">
          {label}
        </p>
        <div className="ds-readable-text ds-readable-text--fluid text-sm sm:text-base text-gray-800 m-0">
          {children}
        </div>
      </div>
    </li>
  );
}

function formatEventDate(iso: string): string {
  return new Date(iso).toLocaleString("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Argentina/Buenos_Aires",
  });
}

export function OrganizerEventsSection({
  title,
  events,
  emptyMessage,
  variant,
}: {
  title: string;
  events: OrganizerPublicLandingEvent[];
  emptyMessage: string;
  variant: "upcoming" | "past";
}) {
  const defaultSort: FeaturedListSortKey = variant === "upcoming" ? "eventDateAsc" : "eventDateDesc";
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState<FeaturedListSortKey>(defaultSort);

  const displayedEvents = useMemo(() => {
    const filtered = filterPublicLandingEvents(events, filter);
    return sortPublicLandingEvents(filtered, sort);
  }, [events, filter, sort]);

  if (events.length === 0) {
    return (
      <section className="ds-fill-width w-full min-w-0 space-y-4">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 m-0">{title}</h2>
        <p className="org-public-section-lead ds-readable-text ds-readable-text--fluid text-gray-600 m-0 text-sm sm:text-base">
          {emptyMessage}
        </p>
      </section>
    );
  }

  return (
    <section className="ds-fill-width w-full min-w-0 space-y-5">
      <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 m-0">{title}</h2>
      <OrganizerPublicListToolbar
        filter={filter}
        sort={sort}
        onFilterChange={setFilter}
        onSortChange={setSort}
        resultCount={displayedEvents.length}
        totalCount={events.length}
        filterId={`org-events-filter-${variant}`}
        sortId={`org-events-sort-${variant}`}
        filterLabel="Buscar eventos"
        sortOptions={
          variant === "upcoming" ? PUBLIC_UPCOMING_EVENT_SORT_OPTIONS : PUBLIC_PAST_EVENT_SORT_OPTIONS
        }
      />
      {displayedEvents.length === 0 ? (
        <p className="ds-readable-text text-sm text-gray-500 m-0">Ningún evento coincide con la búsqueda.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5 ds-overflow-x-soft">
          {displayedEvents.map((ev) => (
            <article
              key={ev.id}
              className="ds-card group rounded-2xl border border-gray-200 overflow-hidden bg-white shadow-sm hover:shadow-lg transition-shadow flex flex-col"
            >
              <div className="relative aspect-[16/10] bg-gray-100 overflow-hidden">
                {ev.coverUrl ? (
                  <img
                    src={ev.coverUrl}
                    alt=""
                    className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                {variant === "past" ? (
                  <span className="absolute top-3 left-3 text-xs font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full bg-gray-900/80 text-white">
                    Finalizado
                  </span>
                ) : null}
                {ev.confirmedPhotographersCount > 0 ? (
                  <span className="absolute top-3 right-3 text-xs font-medium px-2.5 py-1 rounded-full bg-white/95 text-gray-800 shadow-sm">
                    {ev.confirmedPhotographersCount}{" "}
                    {ev.confirmedPhotographersCount === 1 ? "fotógrafo" : "fotógrafos"}
                  </span>
                ) : null}
              </div>
              <div className="p-5 flex flex-col gap-2 flex-1">
                <h3 className="text-lg font-semibold text-gray-900 m-0 line-clamp-2">{ev.title}</h3>
                <p className="text-sm text-gray-600 m-0">
                  {[ev.city, ev.locationName].filter(Boolean).join(" · ")}
                </p>
                <p className="text-xs text-gray-500 m-0">{formatEventDate(ev.startsAt)}</p>
                {ev.photographerLabel ? (
                  <p className="text-xs text-gray-500 m-0 line-clamp-2">{ev.photographerLabel}</p>
                ) : null}
                <div className="flex flex-wrap gap-2 mt-auto pt-3">
                  {ev.galleryUrl ? (
                    <Link
                      href={ev.galleryUrl}
                      className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg text-sm font-medium text-white whitespace-nowrap"
                      style={{ backgroundColor: "var(--org-primary, #c27b3d)" }}
                    >
                      Ver galería
                    </Link>
                  ) : null}
                  {variant === "upcoming" && ev.galleryUrl ? (
                    <Link
                      href={`${ev.galleryUrl}#interesado`}
                      className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg text-sm font-medium border border-gray-300 text-gray-800 bg-white whitespace-nowrap hover:bg-gray-50"
                    >
                      Anotarme como interesado
                    </Link>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export function OrganizerFeaturedGalleriesSection({
  items,
}: {
  items: OrganizerPublicFeaturedGallery[];
}) {
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState<FeaturedListSortKey>("manual");

  const displayedItems = useMemo(() => {
    const filtered = filterPublicFeaturedGalleries(items, filter);
    return sortPublicFeaturedGalleries(filtered, sort);
  }, [items, filter, sort]);

  const readyItems = displayedItems.filter((item) => !item.isComingSoon);
  const comingSoonItems = displayedItems.filter((item) => item.isComingSoon);
  const useHeroLayout = sort === "manual";

  if (items.length === 0) return null;

  return (
    <div className="ds-fill-width w-full min-w-0 space-y-8">
      <div className="ds-stack-section w-full min-w-0">
        <div className="w-full min-w-0">
          <h2 id="org-featured-heading" className="text-2xl sm:text-3xl font-bold text-gray-900 m-0">
            Galerías destacadas
          </h2>
          <p className="org-public-section-lead ds-readable-text ds-readable-text--fluid text-gray-600 m-0 mt-2 text-sm sm:text-base">
            Momentos y coberturas que queremos que no te pierdas.
          </p>
        </div>
        <OrganizerPublicListToolbar
          filter={filter}
          sort={sort}
          onFilterChange={setFilter}
          onSortChange={setSort}
          resultCount={displayedItems.length}
          totalCount={items.length}
          filterId="org-featured-filter"
          sortId="org-featured-sort"
          filterLabel="Buscar galerías"
          filterHint="Nombre, ciudad, fotógrafo, evento o álbum…"
        />
      </div>

      {displayedItems.length === 0 ? (
        <p className="ds-readable-text text-sm text-gray-500 m-0">Ninguna galería coincide con la búsqueda.</p>
      ) : null}

      {readyItems.length > 0 ? (
        <section className="space-y-5" aria-labelledby="org-featured-heading">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {readyItems.map((item, index) => (
              <OrganizerFeaturedGalleryCard
                key={item.id}
                item={item}
                variant="featured"
                layoutClassName={
                  useHeroLayout && index === 0 && readyItems.length >= 3
                    ? "sm:col-span-2 sm:row-span-1 sm:min-h-[280px]"
                    : ""
                }
              />
            ))}
          </div>
        </section>
      ) : null}

      {comingSoonItems.length > 0 ? (
        <section className="space-y-5" aria-labelledby="org-coming-soon-heading">
          <div>
            <h2 id="org-coming-soon-heading" className="text-2xl sm:text-3xl font-bold text-gray-900 m-0">
              Próximamente
            </h2>
            <p className="org-public-section-lead ds-readable-text ds-readable-text--fluid text-gray-600 m-0 mt-2 text-sm sm:text-base">
              Eventos y galerías que todavía no tienen fotos publicadas. Dejanos tus datos para enterarte cuando
              estén listas.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {comingSoonItems.map((item) => (
              <OrganizerFeaturedGalleryCard key={item.id} item={item} variant="comingSoon" />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function PhotographerCard({ p }: { p: OrganizerPublicPhotographerCard }) {
  return (
    <article className="org-photographer-card ds-card group rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 flex flex-col items-stretch text-center shadow-sm hover:shadow-lg hover:border-[#c27b3d]/25 transition-all duration-200 w-full">
      <div className="org-logo-tile mx-auto mb-3 flex h-20 w-20 sm:h-24 sm:w-24 shrink-0 items-center justify-center rounded-2xl border border-gray-200 bg-gray-50 p-2 overflow-hidden">
        {p.logoUrl ? (
          <img
            src={p.logoUrl}
            alt=""
            className="mx-auto block max-h-full max-w-full h-auto w-auto object-contain object-center"
            loading="lazy"
          />
        ) : (
          <span className="text-2xl text-gray-400" aria-hidden>
            📷
          </span>
        )}
      </div>
      <h3 className="font-semibold text-gray-900 m-0 text-base line-clamp-2 w-full min-w-0">{p.name}</h3>
      {p.city ? (
        <p className="ds-readable-text text-sm text-gray-500 m-0 mt-1 w-full">{p.city}</p>
      ) : null}
      <p className="ds-readable-text text-xs text-gray-500 m-0 mt-2 w-full">
        {p.eventsWithOrganizer}{" "}
        {p.eventsWithOrganizer === 1 ? "evento cubierto" : "eventos cubiertos"}
      </p>
      {p.profileUrl ? (
        <Link
          href={p.profileUrl}
          className="mt-4 inline-flex items-center justify-center self-center px-5 py-2.5 rounded-lg text-sm font-medium text-white whitespace-nowrap min-w-[9rem]"
          style={{ backgroundColor: "var(--org-primary, #c27b3d)" }}
        >
          Ver perfil
        </Link>
      ) : null}
    </article>
  );
}

export function OrganizerPhotographersSection({
  title,
  subtitle,
  photographers,
}: {
  title: string;
  subtitle?: string;
  photographers: OrganizerPublicPhotographerCard[];
}) {
  if (photographers.length === 0) return null;

  return (
    <section className="ds-fill-width w-full min-w-0 space-y-5">
      <div className="text-center">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 m-0">{title}</h2>
        {subtitle ? (
          <p className="org-public-section-lead ds-readable-text ds-readable-text--fluid text-gray-600 m-0 mt-2 text-sm sm:text-base mx-auto">
            {subtitle}
          </p>
        ) : null}
      </div>
      <ul className="org-photographers-grid" role="list">
        {photographers.map((p) => (
          <li key={p.userId}>
            <PhotographerCard p={p} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function OrganizerPhotographerCallSection({
  eventSlug,
  contactEmail,
  whatsapp,
}: {
  eventSlug: string | null;
  contactEmail: string | null;
  whatsapp: string | null;
}) {
  const ctaHref = eventSlug ? `/e/${eventSlug}` : null;
  const contactHref = contactEmail
    ? `mailto:${contactEmail}`
    : whatsapp
      ? `https://wa.me/${whatsapp}`
      : null;

  return (
    <section
      className="org-photographer-call ds-fill-width w-full min-w-0 rounded-2xl overflow-hidden border-0 shadow-lg mt-4 sm:mt-6"
      aria-labelledby="org-photographer-call-heading"
      style={{
        background: `linear-gradient(135deg, var(--org-primary, #c27b3d) 0%, var(--org-secondary, #1f2937) 100%)`,
      }}
    >
      <div className="ds-stack-section ds-fill-width p-8 sm:p-10 md:p-12 text-white">
        <h2
          id="org-photographer-call-heading"
          className="text-2xl sm:text-3xl font-bold m-0 text-center text-pretty"
        >
          ¿Querés participar de nuestros eventos?
        </h2>
        <p className="m-0 text-base sm:text-lg text-white/90 text-center leading-relaxed max-w-3xl mx-auto">
          Sumate a la convocatoria, inscribite al evento y subí tus mejores tomas desde la plataforma.
        </p>
        <div className="flex flex-col sm:flex-row flex-wrap gap-3 justify-center pt-1">
          {ctaHref ? (
            <Link
              href={ctaHref}
              className="inline-flex items-center justify-center px-6 py-3 rounded-xl text-base font-semibold bg-white text-gray-900 whitespace-nowrap hover:bg-gray-100 shadow-md"
            >
              Quiero participar
            </Link>
          ) : contactHref ? (
            <a
              href={contactHref}
              target={contactHref.startsWith("http") ? "_blank" : undefined}
              rel={contactHref.startsWith("http") ? "noopener noreferrer" : undefined}
              className="inline-flex items-center justify-center px-6 py-3 rounded-xl text-base font-semibold bg-white text-gray-900 whitespace-nowrap hover:bg-gray-100 shadow-md"
            >
              Contactanos
            </a>
          ) : (
            <p className="text-sm text-white/85 m-0 text-center leading-relaxed w-full max-w-3xl mx-auto">
              Próximamente publicaremos nuevas convocatorias.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

export function OrganizerContactSection({ landing }: { landing: OrganizerPublicLandingView }) {
  const hasContact =
    landing.website ||
    landing.instagram ||
    landing.whatsapp ||
    landing.publicEmail ||
    landing.city ||
    landing.zone;

  if (!hasContact) return null;

  const location = [landing.city, landing.zone].filter(Boolean).join(" · ");
  const websiteHref = landing.website ? normalizeExternalUrl(landing.website) : null;
  const websiteLabel = landing.website?.replace(/^https?:\/\//i, "").replace(/\/$/, "") ?? "";

  return (
    <section className="org-contact-section ds-card ds-fill-width w-full rounded-2xl border border-gray-200 bg-white p-8 sm:p-10">
      <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 m-0 mb-6 sm:mb-8 text-center">
        Contacto
      </h2>
      <ul className="org-contact-list flex flex-col gap-5 sm:gap-6 m-0 p-0 list-none">
        {location ? (
          <ContactRow icon={<IconLocation />} label="Ubicación">
            <span className="text-gray-800">{location}</span>
          </ContactRow>
        ) : null}
        {landing.publicEmail ? (
          <ContactRow icon={<IconMail />} label="Email">
            <a href={`mailto:${landing.publicEmail}`} className={contactLinkClass()}>
              {landing.publicEmail}
            </a>
          </ContactRow>
        ) : null}
        {websiteHref ? (
          <ContactRow icon={<IconGlobe />} label="Sitio web">
            <a href={websiteHref} target="_blank" rel="noopener noreferrer" className={contactLinkClass()}>
              {websiteLabel}
            </a>
          </ContactRow>
        ) : null}
        {landing.instagram ? (
          <ContactRow icon={<IconInstagram />} label="Instagram">
            <a
              href={normalizeInstagramUrl(landing.instagram)}
              target="_blank"
              rel="noopener noreferrer"
              className={contactLinkClass()}
            >
              {landing.instagram.startsWith("http") ? "Ver perfil" : landing.instagram}
            </a>
          </ContactRow>
        ) : null}
        {landing.whatsapp ? (
          <ContactRow icon={<IconWhatsApp />} label="WhatsApp">
            <a
              href={`https://wa.me/${landing.whatsapp.replace(/\D/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className={contactLinkClass()}
            >
              Escribinos por WhatsApp
            </a>
          </ContactRow>
        ) : null}
      </ul>
    </section>
  );
}

