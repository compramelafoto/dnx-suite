import Link from "next/link";
import { EDITORIAL_STOCK } from "@/lib/editorial-stock";

function stock(id: (typeof EDITORIAL_STOCK)[number]["id"]) {
  return EDITORIAL_STOCK.find((item) => item.id === id) ?? EDITORIAL_STOCK[0]!;
}

const nearEvents = [
  {
    title: "Carrera 10K Costanera",
    place: "Buenos Aires",
    when: "Sábado 08:00",
    image: stock("running").src,
    featured: true,
  },
  {
    title: "Feria de diseño independiente",
    place: "Rosario",
    when: "Sábado y domingo",
    image: stock("culture").src,
    featured: false,
  },
  {
    title: "Clásico de barrio",
    place: "Córdoba",
    when: "Domingo 17:00",
    image: stock("football").src,
    featured: false,
  },
] as const;

/** Bloque visual — eventos cerca (sin backend). */
export function HomeNearYouBlock() {
  const [lead, ...rest] = nearEvents;

  return (
    <section aria-labelledby="home-near-heading">
      <div className="mb-8 flex flex-col gap-3 md:mb-10 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <p className="is-eyebrow">Agenda viva</p>
          <h2 id="home-near-heading" className="is-h2 mt-3 text-2xl md:text-3xl lg:text-4xl">
            Hoy cerca tuyo
          </h2>
          <p className="is-body mt-3 max-w-xl">
            Descubrí qué se mueve este fin de semana. Pronto vas a poder filtrar
            por ciudad y distancia.
          </p>
        </div>
        <Link href="/contacto" className="is-btn is-btn-ghost min-h-11 self-start">
          Quiero publicar mi evento
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-12 md:gap-5">
        {lead ? (
          <article className="group relative overflow-hidden md:col-span-7 md:min-h-[28rem]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lead.image}
              alt={lead.title}
              className="aspect-[4/5] w-full object-cover transition-[transform] duration-[var(--is-duration-300)] group-hover:scale-[1.03] md:absolute md:inset-0 md:aspect-auto md:h-full"
              loading="lazy"
              draggable={false}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[color-mix(in_oklab,var(--is-graphite-950)_80%,transparent)] via-transparent to-transparent" />
            <div className="absolute inset-x-0 bottom-0 space-y-2 p-5 md:p-7">
              <p className="is-label !text-[var(--is-orange-300)]">{lead.when}</p>
              <h3 className="is-h3 text-xl text-[var(--is-white-0)] md:text-2xl lg:text-3xl">
                {lead.title}
              </h3>
              <p className="text-sm text-[color-mix(in_oklab,var(--is-white-0)_80%,transparent)]">
                {lead.place}
              </p>
            </div>
          </article>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2 md:col-span-5 md:grid-cols-1 md:gap-5">
          {rest.map((event) => (
            <article key={event.title} className="group relative overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={event.image}
                alt={event.title}
                className="aspect-[16/11] w-full object-cover transition-[transform] duration-[var(--is-duration-300)] group-hover:scale-[1.03] md:aspect-[5/3] md:min-h-[13rem]"
                loading="lazy"
                draggable={false}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[color-mix(in_oklab,var(--is-graphite-950)_75%,transparent)] to-transparent" />
              <div className="absolute inset-x-0 bottom-0 space-y-1 p-4 md:p-5">
                <p className="is-label !text-[var(--is-orange-300)]">{event.when}</p>
                <h3 className="is-h4 text-base text-[var(--is-white-0)] md:text-lg">
                  {event.title}
                </h3>
                <p className="text-xs text-[color-mix(in_oklab,var(--is-white-0)_78%,transparent)]">
                  {event.place}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
