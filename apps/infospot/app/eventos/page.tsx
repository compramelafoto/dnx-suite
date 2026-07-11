import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { prisma } from "@repo/db";
import { EditorialContainer, Section } from "@/components/foundations";
import { EventCard } from "@/components/events/EventCard";
import { NearMeButton } from "@/components/events/NearMeButton";
import { getEventProvinces, getPublishedEventsSplit } from "@/lib/events";
import { NEAR_ME_RADIUS_KM, parseGeoParams } from "@/lib/geo";

export const metadata: Metadata = {
  title: "Eventos",
  description: "Agenda de eventos publicados en Info Spot.",
  alternates: { canonical: "/eventos" },
};

type Props = {
  searchParams: Promise<{
    categoria?: string;
    provincia?: string;
    cuando?: string;
    lat?: string;
    lng?: string;
    radio?: string;
  }>;
};

export default async function EventosPage({ searchParams }: Props) {
  const params = await searchParams;
  const categories = await prisma.infoSpotCategory.findMany({
    orderBy: { name: "asc" },
    select: { name: true, slug: true },
  });
  const provinces = await getEventProvinces();
  const when =
    params.cuando === "pasados" || params.cuando === "todos" ? params.cuando : "proximos";
  const near = parseGeoParams(params);

  const { upcoming, past } = await getPublishedEventsSplit({
    categorySlug: params.categoria,
    province: params.provincia,
    takeUpcoming: when === "pasados" ? 0 : 24,
    takePast: when === "proximos" ? 0 : 12,
    near,
  });

  const showUpcoming = when !== "pasados";
  const showPast = when !== "proximos";
  const radiusKm = near?.radiusKm ?? NEAR_ME_RADIUS_KM;

  return (
    <Section spacing="lg">
      <EditorialContainer>
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="is-eyebrow">Agenda</p>
            <h1 className="is-h1 mt-3 text-3xl md:text-4xl">Eventos</h1>
            <p className="is-body mt-3">
              Lo que está por pasar — y lo que ya dejó huella. Publicá el tuyo
              gratuitamente.
            </p>
          </div>
          <Link
            href="/publicar-evento"
            className="is-btn is-btn-solid h-11 px-5 text-sm"
          >
            Publicar mi evento
          </Link>
        </div>

        <form className="mt-10 flex flex-wrap items-start gap-3 border-y border-[var(--is-border)] py-5">
          {near ? (
            <>
              <input type="hidden" name="lat" value={near.lat} />
              <input type="hidden" name="lng" value={near.lng} />
              <input type="hidden" name="radio" value={near.radiusKm} />
            </>
          ) : null}
          <label className="text-sm">
            <span className="sr-only">Categoría</span>
            <select
              name="categoria"
              defaultValue={params.categoria || ""}
              className="min-h-11 rounded-[var(--is-radius-sm)] border border-[var(--is-border-strong)] px-3"
            >
              <option value="">Todas las categorías</option>
              {categories.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="sr-only">Provincia</span>
            <select
              name="provincia"
              defaultValue={params.provincia || ""}
              className="min-h-11 rounded-[var(--is-radius-sm)] border border-[var(--is-border-strong)] px-3"
            >
              <option value="">Todas las provincias</option>
              {provinces.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="sr-only">Fecha</span>
            <select
              name="cuando"
              defaultValue={when}
              className="min-h-11 rounded-[var(--is-radius-sm)] border border-[var(--is-border-strong)] px-3"
            >
              <option value="proximos">Próximos</option>
              <option value="pasados">Anteriores</option>
              <option value="todos">Todos</option>
            </select>
          </label>
          <button
            type="submit"
            className="min-h-11 px-4 text-sm font-medium ring-1 ring-[var(--is-border)]"
          >
            Filtrar
          </button>
          <Suspense
            fallback={
              <span className="inline-flex min-h-11 items-center px-4 text-sm text-[var(--is-muted)]">
                Ubicación…
              </span>
            }
          >
            <NearMeButton active={Boolean(near)} />
          </Suspense>
        </form>

        {near ? (
          <p className="mt-4 text-sm text-[var(--is-text-secondary)]" role="status">
            Mostrando eventos a menos de {radiusKm} km de tu ubicación
            {upcoming.length + past.length === 0
              ? ". No encontramos resultados en ese radio."
              : "."}
          </p>
        ) : null}

        {showUpcoming ? (
          <section className="mt-12" aria-labelledby="upcoming-heading">
            <h2 id="upcoming-heading" className="is-h2 text-2xl md:text-3xl">
              Próximos
            </h2>
            {upcoming.length === 0 ? (
              <p className="mt-6 text-[var(--is-text-secondary)]">
                {near
                  ? "No hay próximos eventos cerca tuyo con estos filtros."
                  : "Todavía no hay próximos eventos publicados."}{" "}
                {!near ? (
                  <Link
                    href="/publicar-evento"
                    className="text-[var(--is-accent)] hover:underline"
                  >
                    Sé el primero en sumar el tuyo
                  </Link>
                ) : null}
              </p>
            ) : (
              <div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
                {upcoming.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            )}
          </section>
        ) : null}

        {showPast && past.length > 0 ? (
          <section className="mt-20" aria-labelledby="past-heading">
            <h2 id="past-heading" className="is-h2 text-2xl md:text-3xl">
              Anteriores
            </h2>
            <div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {past.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          </section>
        ) : null}
      </EditorialContainer>
    </Section>
  );
}
