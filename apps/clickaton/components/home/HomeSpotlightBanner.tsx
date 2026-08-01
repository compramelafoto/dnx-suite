"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/Button";

export type HomeSpotlightSlide = {
  id: string;
  kind: "edition" | "news";
  eyebrow: string;
  title: string;
  description: string;
  href: string;
  ctaLabel: string;
  /** CTA secundaria contextual (sponsor, ciudad, agenda…). */
  secondaryHref?: string;
  secondaryCtaLabel?: string;
  imageUrl?: string;
  imageUrlVertical?: string;
};

const AUTOPLAY_MS = 7000;

type Props = {
  slides: HomeSpotlightSlide[];
};

export function HomeSpotlightBanner({ slides }: Props) {
  const items = slides.filter(Boolean);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [progressKey, setProgressKey] = useState(0);
  const count = items.length;
  const current = items[Math.min(index, Math.max(0, count - 1))] ?? null;

  const goTo = useCallback(
    (next: number) => {
      if (count <= 0) return;
      setIndex(((next % count) + count) % count);
      setProgressKey((k) => k + 1);
    },
    [count],
  );

  useEffect(() => {
    if (count <= 1 || paused) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % count);
      setProgressKey((k) => k + 1);
    }, AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [count, paused]);

  if (!current) return null;

  const hasCover = Boolean(current.imageUrl || current.imageUrlVertical);
  const revealActions = paused;

  return (
    <section
      className="group relative overflow-hidden border-b border-ck-border bg-ck-bg"
      aria-roledescription="carousel"
      aria-label="Destacados Clickatón"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setPaused(false);
        }
      }}
    >
      <div className="relative min-h-[30rem] md:min-h-[34rem] lg:min-h-[38rem]">
        {items.map((slide, i) => {
          const desktopSrc = slide.imageUrl || slide.imageUrlVertical;
          const mobileSrc = slide.imageUrlVertical || slide.imageUrl;
          return (
            <div
              key={slide.id}
              className={[
                "absolute inset-0 transition-opacity duration-700 ease-out",
                i === index ? "opacity-100" : "pointer-events-none opacity-0",
              ].join(" ")}
              aria-hidden={i !== index}
            >
              {desktopSrc ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={desktopSrc}
                    alt=""
                    className="absolute inset-0 hidden h-full w-full scale-105 object-cover transition-transform duration-[7000ms] ease-out md:block group-hover:scale-100"
                    loading={i === 0 ? "eager" : "lazy"}
                    draggable={false}
                  />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={mobileSrc || desktopSrc}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover md:hidden"
                    loading={i === 0 ? "eager" : "lazy"}
                    draggable={false}
                  />
                </>
              ) : (
                <div
                  className="absolute inset-0 bg-[linear-gradient(145deg,#2a2418_0%,#121212_45%,#0a0a0a_100%)]"
                  aria-hidden
                />
              )}
            </div>
          );
        })}

        {/* Overlay más liviano cuando hay portada admin, para que se vea la imagen */}
        <div
          className={
            hasCover
              ? "absolute inset-0 bg-[linear-gradient(90deg,rgb(10_10_10_/_0.72)_0%,rgb(10_10_10_/_0.45)_42%,rgb(10_10_10_/_0.25)_100%)] md:bg-[linear-gradient(90deg,rgb(10_10_10_/_0.78)_0%,rgb(10_10_10_/_0.4)_50%,rgb(10_10_10_/_0.15)_100%)]"
              : "absolute inset-0 bg-[linear-gradient(180deg,rgb(17_17_17_/_0.35)_0%,rgb(17_17_17_/_0.55)_45%,rgb(17_17_17_/_0.88)_100%)]"
          }
          aria-hidden
        />

        <Container className="relative z-[2] flex min-h-[inherit] flex-col justify-end py-12 md:py-16">
          <div className="max-w-2xl space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <p className="ck-overline text-ck-yellow">{current.eyebrow}</p>
              {count > 1 ? (
                <span className="ck-caption rounded-full border border-ck-border/80 bg-ck-bg/50 px-2.5 py-1 text-ck-text-muted backdrop-blur-sm">
                  {index + 1} / {count}
                </span>
              ) : null}
            </div>
            <h2
              key={`${current.id}-title`}
              className="ck-display-md max-w-[18ch] text-balance text-ck-text drop-shadow-[0_2px_16px_rgb(0_0_0_/_0.45)]"
            >
              {current.title}
            </h2>
            <p className="ck-body max-w-prose text-ck-text-secondary drop-shadow-[0_1px_8px_rgb(0_0_0_/_0.4)]">
              {current.description}
            </p>

            {/* Desktop: CTAs al hover/focus. Móvil: siempre visibles (no hay hover). */}
            <div
              className={[
                "flex flex-wrap gap-3 pt-2 transition-all duration-300 ease-out",
                "max-md:translate-y-0 max-md:opacity-100",
                revealActions
                  ? "md:translate-y-0 md:opacity-100"
                  : "md:pointer-events-none md:translate-y-2 md:opacity-0",
              ].join(" ")}
            >
              <Button href={current.href} variant="primary">
                {current.ctaLabel}
              </Button>
              {current.secondaryHref && current.secondaryCtaLabel ? (
                <Button href={current.secondaryHref} variant="secondary">
                  {current.secondaryCtaLabel}
                </Button>
              ) : null}
            </div>
            <p
              className={[
                "ck-caption text-ck-text-muted transition-opacity duration-300 max-md:hidden",
                revealActions ? "opacity-0" : "opacity-100",
              ].join(" ")}
            >
              Pasá el mouse para ver acciones
            </p>
          </div>

          <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-4">
            {count > 1 ? (
              <>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className="ck-caption rounded border border-ck-border px-3 py-2 text-ck-text-secondary hover:border-ck-yellow hover:text-ck-yellow"
                    onClick={() => goTo(index - 1)}
                    aria-label="Slide anterior"
                  >
                    ←
                  </button>
                  <div className="flex gap-2" role="tablist" aria-label="Slides">
                    {items.map((slide, i) => (
                      <button
                        key={slide.id}
                        type="button"
                        role="tab"
                        aria-selected={i === index}
                        aria-label={`${slide.eyebrow}: ${slide.title}`}
                        title={slide.title}
                        className={[
                          "h-2.5 rounded-full transition-all",
                          i === index
                            ? "w-7 bg-ck-yellow"
                            : "w-2.5 bg-ck-border hover:bg-ck-text-muted",
                        ].join(" ")}
                        onClick={() => goTo(i)}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    className="ck-caption rounded border border-ck-border px-3 py-2 text-ck-text-secondary hover:border-ck-yellow hover:text-ck-yellow"
                    onClick={() => goTo(index + 1)}
                    aria-label="Slide siguiente"
                  >
                    →
                  </button>
                </div>

                {/* Barra de progreso del autoplay */}
                <div
                  className="h-0.5 flex-1 overflow-hidden rounded-full bg-ck-border/60 sm:max-w-xs"
                  aria-hidden
                >
                  <div
                    key={progressKey}
                    className={[
                      "h-full origin-left bg-ck-yellow",
                      paused ? "scale-x-0" : "ck-spotlight-progress",
                    ].join(" ")}
                  />
                </div>

                <Link
                  href={current.href}
                  className="ck-caption text-ck-text-muted underline-offset-4 hover:text-ck-yellow hover:underline sm:ml-auto"
                >
                  {current.kind === "edition" ? "Ir a la edición" : "Ver más"}
                </Link>
              </>
            ) : (
              <Link
                href={current.href}
                className="ck-caption text-ck-text-muted underline-offset-4 hover:text-ck-yellow hover:underline"
              >
                {current.kind === "edition" ? "Ir a la edición" : "Ver más"}
              </Link>
            )}
          </div>
        </Container>
      </div>

    </section>
  );
}
