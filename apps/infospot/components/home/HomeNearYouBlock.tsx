"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import type { DistributionEventCard } from "@/lib/distribution";

function formatWhen(date: Date | string | null | undefined) {
  const d = date instanceof Date ? date : date ? new Date(date) : null;
  if (!d || Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(d);
}

/** Bloque cercanía: datos reales o fallback a próximos. */
export function HomeNearYouBlock({
  events,
  hasUserLocation,
}: {
  events: DistributionEventCard[];
  hasUserLocation: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [geoError, setGeoError] = useState<string | null>(null);

  const enableLocation = useCallback(() => {
    setGeoError(null);
    if (!navigator.geolocation) {
      setGeoError("Tu navegador no soporta geolocalización.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = new URLSearchParams(searchParams.toString());
        next.set("lat", pos.coords.latitude.toFixed(5));
        next.set("lng", pos.coords.longitude.toFixed(5));
        next.set("radio", "100");
        startTransition(() => {
          router.push(`/?${next.toString()}#cerca`);
        });
      },
      () => setGeoError("No pudimos obtener tu ubicación."),
      { enableHighAccuracy: false, timeout: 10000 },
    );
  }, [router, searchParams]);

  if (events.length === 0 && !hasUserLocation) {
    return (
      <section id="cerca" aria-labelledby="home-near-heading" className="space-y-6">
        <div className="max-w-2xl">
          <p className="is-eyebrow">Agenda viva</p>
          <h2 id="home-near-heading" className="is-h2 mt-3 text-2xl md:text-3xl">
            Eventos cerca tuyo
          </h2>
          <p className="is-body mt-3">
            Activá la ubicación para ver qué hay cerca. No la pedimos al cargar la
            página.
          </p>
        </div>
        <button
          type="button"
          onClick={enableLocation}
          disabled={pending}
          className="is-btn is-btn-solid h-11 px-5 text-sm"
        >
          Usar mi ubicación
        </button>
        {geoError ? <p className="text-sm text-amber-800">{geoError}</p> : null}
      </section>
    );
  }

  if (events.length === 0) {
    return (
      <section id="cerca" className="space-y-4">
        <h2 className="is-h2 text-2xl">Cerca tuyo</h2>
        <p className="is-body">
          No hay eventos próximos con ubicación confirmada en ese radio.{" "}
          <Link href="/eventos" className="text-[var(--is-accent)] underline">
            Ver toda la agenda
          </Link>
        </p>
      </section>
    );
  }

  const [lead, ...rest] = events;

  return (
    <section id="cerca" aria-labelledby="home-near-heading">
      <div className="mb-8 flex flex-col gap-3 md:mb-10 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <p className="is-eyebrow">Agenda viva</p>
          <h2 id="home-near-heading" className="is-h2 mt-3 text-2xl md:text-3xl lg:text-4xl">
            {hasUserLocation ? "Cerca tuyo" : "Próximos eventos"}
          </h2>
          <p className="is-body mt-3 max-w-xl">
            {hasUserLocation
              ? "Ordenados por distancia. Las coordenadas exactas de eventos ocultos no se muestran."
              : "Sin tu ubicación mostramos próximos eventos generales."}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {!hasUserLocation ? (
            <button
              type="button"
              onClick={enableLocation}
              disabled={pending}
              className="is-btn is-btn-secondary min-h-11 px-4 text-sm"
            >
              Usar mi ubicación
            </button>
          ) : null}
          <Link href="/eventos" className="is-btn is-btn-ghost min-h-11 self-start">
            Ver agenda
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-12 md:gap-5">
        {lead ? (
          <article className="group relative overflow-hidden md:col-span-7 md:min-h-[28rem]">
            <Link href={`/eventos/${lead.slug}`} className="absolute inset-0 z-10">
              <span className="sr-only">{lead.title}</span>
            </Link>
            {lead.coverImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={lead.coverImageUrl}
                alt=""
                className="aspect-[4/5] w-full object-cover transition-[transform] duration-300 group-hover:scale-[1.03] md:absolute md:inset-0 md:h-full md:aspect-auto"
                loading="lazy"
              />
            ) : (
              <div className="aspect-[4/5] bg-[var(--is-graphite-900)] md:absolute md:inset-0 md:aspect-auto" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[color-mix(in_oklab,var(--is-graphite-950)_80%,transparent)] via-transparent to-transparent" />
            <div className="absolute inset-x-0 bottom-0 space-y-2 p-5 md:p-7">
              <p className="is-label !text-[var(--is-orange-300)]">
                {lead.distanceLabel || lead.temporalLabel || formatWhen(lead.startAt)}
              </p>
              <h3 className="is-h3 text-xl text-[var(--is-white-0)] md:text-2xl lg:text-3xl">
                {lead.title}
              </h3>
              <p className="text-sm text-[color-mix(in_oklab,var(--is-white-0)_80%,transparent)]">
                {lead.locationLabel}
              </p>
            </div>
          </article>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2 md:col-span-5 md:grid-cols-1 md:gap-5">
          {rest.map((event) => (
            <article key={event.id} className="group relative overflow-hidden">
              <Link href={`/eventos/${event.slug}`} className="absolute inset-0 z-10">
                <span className="sr-only">{event.title}</span>
              </Link>
              {event.coverImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={event.coverImageUrl}
                  alt=""
                  className="aspect-[16/11] w-full object-cover transition-[transform] duration-300 group-hover:scale-[1.03] md:min-h-[13rem]"
                  loading="lazy"
                />
              ) : (
                <div className="aspect-[16/11] bg-[var(--is-graphite-900)]" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[color-mix(in_oklab,var(--is-graphite-950)_75%,transparent)] to-transparent" />
              <div className="absolute inset-x-0 bottom-0 space-y-1 p-4 md:p-5">
                <p className="is-label !text-[var(--is-orange-300)]">
                  {event.distanceLabel || formatWhen(event.startAt)}
                </p>
                <h3 className="is-h4 text-base text-[var(--is-white-0)] md:text-lg">
                  {event.title}
                </h3>
                <p className="text-xs text-[color-mix(in_oklab,var(--is-white-0)_78%,transparent)]">
                  {event.locationLabel}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
      {geoError ? <p className="mt-4 text-sm text-amber-800">{geoError}</p> : null}
    </section>
  );
}
