import Link from "next/link";
import { pickHeroStock } from "@/lib/editorial-stock";
import { SiteContainer } from "@/components/foundations";

/**
 * Hero de descubrimiento — no vende una noticia, vende el punto de encuentro.
 */
export function HomePlatformHero() {
  const hero = pickHeroStock("platform-hero", "recital festival deporte");

  return (
    <section className="relative min-h-[88vw] overflow-hidden bg-[var(--is-graphite-950)] sm:min-h-[70vw] lg:min-h-[min(90vh,880px)]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={hero.src}
        alt={hero.alt}
        className="absolute inset-0 h-full w-full scale-[1.02] object-cover"
        loading="eager"
        decoding="sync"
        fetchPriority="high"
        draggable={false}
      />
      <div
        className="absolute inset-0 bg-gradient-to-t from-[color-mix(in_oklab,var(--is-graphite-950)_90%,transparent)] via-[color-mix(in_oklab,var(--is-graphite-950)_40%,transparent)] to-[color-mix(in_oklab,var(--is-graphite-950)_22%,transparent)]"
        aria-hidden
      />

      <SiteContainer className="relative flex min-h-[inherit] items-end pb-14 pt-36 md:pb-20 md:pt-40 lg:pb-24">
        <div className="max-w-4xl space-y-7 text-[var(--is-white-0)] md:space-y-8">
          <p className="is-eyebrow !text-[var(--is-orange-300)]">
            Donde nacen los eventos
          </p>

          <h1 className="is-display-hero max-w-[15ch] text-wrap break-words !text-[var(--is-white-0)]">
            Todo lo que está pasando, empieza acá
          </h1>

          <p className="max-w-2xl text-lg leading-relaxed text-[color-mix(in_oklab,var(--is-white-0)_90%,transparent)] md:text-xl md:leading-relaxed lg:text-[1.35rem]">
            El punto de encuentro entre organizadores, fotógrafos y personas que
            quieren vivir algo. Descubrí. Publicá. Contá la historia.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <Link
              href="/publicar-evento"
              className="is-btn is-btn-on-dark h-11 px-6 text-sm"
            >
              Publicar mi evento
            </Link>
            <Link
              href="/eventos"
              className="is-btn is-btn-outline-on-dark h-11 px-5 text-sm font-medium"
            >
              Descubrir eventos
            </Link>
          </div>
        </div>
      </SiteContainer>
    </section>
  );
}
