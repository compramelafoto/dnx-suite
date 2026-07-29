"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { DistributionBannerItem } from "@/lib/distribution";

const AUTOPLAY_MS = 6500;

type Props = {
  items: DistributionBannerItem[];
};

/** Slider del HERO: varias notas/eventos con CTA fijo «Ver más». */
export function HomeHeroSlider({ items }: Props) {
  const slides = items.filter(Boolean);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const count = slides.length;
  const current = slides[Math.min(index, Math.max(0, count - 1))] ?? null;

  const goTo = useCallback(
    (next: number) => {
      if (count <= 0) return;
      setIndex(((next % count) + count) % count);
    },
    [count],
  );

  useEffect(() => {
    if (count <= 1 || paused) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % count);
    }, AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [count, paused]);

  if (!current) return null;

  if (count === 1) {
    return <HeroSlideFrame item={current} />;
  }

  return (
    <section
      className="relative min-h-[72vw] overflow-hidden bg-[var(--is-graphite-950)] sm:min-h-[52vw] lg:min-h-[min(72vh,720px)]"
      aria-roledescription="carousel"
      aria-label="Destacados de portada"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setPaused(false);
        }
      }}
    >
      {slides.map((item, i) => (
        <div
          key={`${item.kind}-${item.id}-${item.placementId ?? "fb"}`}
          className={[
            "absolute inset-0 transition-opacity duration-700 ease-out",
            i === index ? "opacity-100" : "pointer-events-none opacity-0",
          ].join(" ")}
          aria-hidden={i !== index}
        >
          {item.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.imageUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              loading={i === 0 ? "eager" : "lazy"}
              fetchPriority={i === 0 ? "high" : "auto"}
              draggable={false}
            />
          ) : (
            <div
              className="absolute inset-0 bg-[linear-gradient(145deg,var(--is-graphite-800),var(--is-graphite-950))]"
              aria-hidden
            />
          )}
        </div>
      ))}

      <div
        className="absolute inset-0 bg-gradient-to-t from-[color-mix(in_oklab,var(--is-graphite-950)_92%,transparent)] via-[color-mix(in_oklab,var(--is-graphite-950)_45%,transparent)] to-[color-mix(in_oklab,var(--is-graphite-950)_25%,transparent)]"
        aria-hidden
      />

      <div className="relative mx-auto flex min-h-[inherit] max-w-6xl flex-col justify-end px-6 pb-14 pt-36 md:px-10 md:pb-20 md:pt-40 lg:pb-24">
        <div className="max-w-3xl space-y-5 text-[var(--is-white-0)] md:space-y-6">
          <p className="is-eyebrow !text-[var(--is-orange-300)]">
            {current.kind === "event" ? "Agenda" : "Cobertura"}
            {current.source === "fallback" ? " · destacado" : ""}
          </p>
          <h1
            key={`${current.id}-title`}
            className="is-display-hero max-w-[18ch] text-wrap break-words !text-[var(--is-white-0)]"
          >
            {current.title}
          </h1>
          {current.subtitle ? (
            <p
              key={`${current.id}-sub`}
              className="max-w-2xl text-lg leading-relaxed text-[color-mix(in_oklab,var(--is-white-0)_88%,transparent)] md:text-xl"
            >
              {current.subtitle}
            </p>
          ) : null}

          {/* CTA fijo en posición; solo cambia el destino. */}
          <div className="flex flex-wrap items-center gap-4 pt-2">
            <Link
              href={current.href}
              className="is-btn is-btn-on-dark h-11 min-w-[8.5rem] px-6 text-sm"
            >
              Ver más
            </Link>

            <div className="flex items-center gap-2" role="tablist" aria-label="Slides del banner">
              {slides.map((item, i) => (
                <button
                  key={`dot-${item.id}-${i}`}
                  type="button"
                  role="tab"
                  aria-selected={i === index}
                  aria-label={`Ir al slide ${i + 1}: ${item.title}`}
                  className={[
                    "h-2.5 rounded-full transition-all",
                    i === index
                      ? "w-8 bg-[var(--is-orange-300)]"
                      : "w-2.5 bg-[color-mix(in_oklab,var(--is-white-0)_45%,transparent)] hover:bg-[color-mix(in_oklab,var(--is-white-0)_70%,transparent)]",
                  ].join(" ")}
                  onClick={() => goTo(i)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroSlideFrame({ item }: { item: DistributionBannerItem }) {
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
