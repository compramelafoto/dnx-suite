"use client";

import { useCallback, useEffect, useState } from "react";
import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/Button";
import {
  EDITION_COVER_HORIZONTAL,
  EDITION_COVER_VERTICAL,
} from "@/lib/admin/editions/cover-specs";

export type HomeSpotlightSlide = {
  id: string;
  kind: "edition" | "news";
  eyebrow: string;
  title: string;
  description: string;
  href: string;
  ctaLabel: string;
  secondaryHref?: string;
  secondaryCtaLabel?: string;
  imageUrl?: string;
  imageUrlVertical?: string;
};

const AUTOPLAY_MS = 3000;

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
  /** Portada de edición ya trae diseño tipográfico: no duplicar título encima. */
  const artDirectedEdition = current.kind === "edition" && hasCover;

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
      {/*
        Proporciones oficiales (cover-specs):
        - Móvil: 1080×1920 (9:16)
        - Desktop: 1920×1080 (16:9)
      */}
      <div className="relative w-full aspect-[9/16] max-h-[min(85vh,42rem)] md:aspect-video md:max-h-none">
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
                    width={EDITION_COVER_HORIZONTAL.width}
                    height={EDITION_COVER_HORIZONTAL.height}
                    className="absolute inset-0 hidden h-full w-full object-cover object-center md:block"
                    loading={i === 0 ? "eager" : "lazy"}
                    draggable={false}
                  />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={mobileSrc || desktopSrc}
                    alt=""
                    width={EDITION_COVER_VERTICAL.width}
                    height={EDITION_COVER_VERTICAL.height}
                    className="absolute inset-0 h-full w-full object-cover object-center md:hidden"
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

        <div
          className={
            artDirectedEdition
              ? "absolute inset-0 bg-[linear-gradient(180deg,transparent_45%,rgb(10_10_10_/_0.5)_100%)]"
              : hasCover
                ? "absolute inset-0 bg-[linear-gradient(90deg,rgb(10_10_10_/_0.55)_0%,rgb(10_10_10_/_0.25)_50%,rgb(10_10_10_/_0.15)_100%)]"
                : "absolute inset-0 bg-[linear-gradient(180deg,rgb(17_17_17_/_0.35)_0%,rgb(17_17_17_/_0.55)_45%,rgb(17_17_17_/_0.88)_100%)]"
          }
          aria-hidden
        />

        <Container className="relative z-[2] flex h-full flex-col justify-end pb-20 pt-10 md:pb-24 md:pt-14">
          {!artDirectedEdition ? (
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
            </div>
          ) : (
            <h2 className="sr-only">{current.title}</h2>
          )}

          <div
            className={[
              "mt-6 flex flex-wrap gap-3 transition-all duration-300 ease-out",
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
              "ck-caption mt-3 text-ck-text-muted transition-opacity duration-300 max-md:hidden",
              revealActions ? "opacity-0" : "opacity-100",
            ].join(" ")}
          >
            Pasá el mouse para ver acciones
          </p>
        </Container>

        {count > 1 ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-5 z-[3] flex justify-center px-4 md:bottom-7">
            <div className="pointer-events-auto flex flex-col items-center gap-3">
              <div className="flex items-center gap-3 rounded-full border border-ck-border/70 bg-ck-bg/55 px-3 py-2 backdrop-blur-md">
                <button
                  type="button"
                  className="ck-caption rounded border border-ck-border px-3 py-1.5 text-ck-text-secondary hover:border-ck-yellow hover:text-ck-yellow"
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
                  className="ck-caption rounded border border-ck-border px-3 py-1.5 text-ck-text-secondary hover:border-ck-yellow hover:text-ck-yellow"
                  onClick={() => goTo(index + 1)}
                  aria-label="Slide siguiente"
                >
                  →
                </button>
              </div>
              <div
                className="h-0.5 w-40 overflow-hidden rounded-full bg-ck-border/60"
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
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
