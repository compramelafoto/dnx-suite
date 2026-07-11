import Link from "next/link";
import { EDITORIAL_STOCK } from "@/lib/editorial-stock";

function stock(id: (typeof EDITORIAL_STOCK)[number]["id"]) {
  return EDITORIAL_STOCK.find((item) => item.id === id) ?? EDITORIAL_STOCK[0]!;
}

const openings = [
  {
    event: "Carrera 10K Costanera",
    need: "2 fotógrafos · llegada y meta",
    image: stock("running").src,
  },
  {
    event: "Festival de diseño",
    need: "Cobertura de stands y público",
    image: stock("festival").src,
  },
  {
    event: "Noche de recital",
    need: "Escenario + backstage",
    image: stock("concert").src,
  },
] as const;

/**
 * Fotógrafos como consecuencia de los eventos — no como bloque aislado.
 */
export function HomePhotographersCall() {
  return (
    <section aria-labelledby="home-photographers-heading">
      <div className="mb-10 max-w-2xl md:mb-12">
        <p className="is-eyebrow">Coberturas abiertas</p>
        <h2
          id="home-photographers-heading"
          className="is-h2 mt-3 text-2xl md:text-3xl lg:text-4xl"
        >
          Estos eventos están buscando fotógrafos
        </h2>
        <p className="is-body mt-3">
          Cuando un organizador publica, la convocatoria nace sola. Preparado
          para cuando activemos las solicitudes reales.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        {openings.map((item) => (
          <article key={item.event} className="group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.image}
              alt={item.event}
              className="aspect-[4/5] w-full object-cover transition-[transform] duration-[var(--is-duration-300)] group-hover:scale-[1.02]"
              loading="lazy"
              draggable={false}
            />
            <div className="mt-4 space-y-1">
              <p className="is-label">Convocatoria</p>
              <h3 className="is-h4 text-lg">{item.event}</h3>
              <p className="text-sm text-[var(--is-text-secondary)]">{item.need}</p>
            </div>
          </article>
        ))}
      </div>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link
          href="/contacto"
          className="is-btn is-btn-solid h-10 px-5 text-sm"
        >
          Quiero cubrir eventos
        </Link>
        <Link
          href="/quienes-somos"
          className="is-btn is-btn-secondary h-10 px-4 text-sm font-medium"
        >
          Cómo trabajamos
        </Link>
      </div>
    </section>
  );
}
