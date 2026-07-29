import Link from "next/link";
import type { DistributionBannerItem } from "@/lib/distribution";

/** Banner editorial de home (placement o fallback). */
export function HomeEditorialBanner({ item }: { item: DistributionBannerItem | null }) {
  if (!item) return null;

  return (
    <section className="relative min-h-[72vw] overflow-hidden bg-[var(--is-graphite-950)] sm:min-h-[52vw] lg:min-h-[min(72vh,720px)]">
      {item.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.imageUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          loading="eager"
          fetchPriority="high"
          draggable={false}
        />
      ) : (
        <div
          className="absolute inset-0 bg-[linear-gradient(145deg,var(--is-graphite-800),var(--is-graphite-950))]"
          aria-hidden
        />
      )}
      <div
        className="absolute inset-0 bg-gradient-to-t from-[color-mix(in_oklab,var(--is-graphite-950)_92%,transparent)] via-[color-mix(in_oklab,var(--is-graphite-950)_45%,transparent)] to-[color-mix(in_oklab,var(--is-graphite-950)_25%,transparent)]"
        aria-hidden
      />
      <div className="relative mx-auto flex min-h-[inherit] max-w-6xl items-end px-6 pb-14 pt-36 md:px-10 md:pb-20 md:pt-40 lg:pb-24">
        <div className="max-w-3xl space-y-5 text-[var(--is-white-0)] md:space-y-6">
          <p className="is-eyebrow !text-[var(--is-orange-300)]">
            {item.kind === "event" ? "Agenda" : "Cobertura"}
            {item.source === "fallback" ? " · destacado" : ""}
          </p>
          <h1 className="is-display-hero max-w-[18ch] text-wrap break-words !text-[var(--is-white-0)]">
            {item.title}
          </h1>
          {item.subtitle ? (
            <p className="max-w-2xl text-lg leading-relaxed text-[color-mix(in_oklab,var(--is-white-0)_88%,transparent)] md:text-xl">
              {item.subtitle}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-3 pt-2">
            <Link href={item.href} className="is-btn is-btn-on-dark h-11 min-w-[8.5rem] px-6 text-sm">
              Ver más
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
