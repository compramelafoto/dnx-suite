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
  imageUrl?: string;
  imageUrlVertical?: string;
};

const AUTOPLAY_MS = 6000;

type Props = {
  slides: HomeSpotlightSlide[];
};

export function HomeSpotlightBanner({ slides }: Props) {
  const items = slides.filter(Boolean);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = items.length;
  const current = items[Math.min(index, Math.max(0, count - 1))] ?? null;

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

  return (
    <section
      className="relative overflow-hidden border-b border-ck-border bg-ck-bg"
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
      <div className="relative min-h-[28rem] md:min-h-[32rem] lg:min-h-[36rem]">
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
                    className="absolute inset-0 hidden h-full w-full object-cover md:block"
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
                  className="absolute inset-0 bg-[linear-gradient(145deg,#1a1a1a,#0a0a0a)]"
                  aria-hidden
                />
              )}
            </div>
          );
        })}

        <div
          className="absolute inset-0 bg-[linear-gradient(180deg,rgb(17_17_17_/_0.35)_0%,rgb(17_17_17_/_0.55)_45%,rgb(17_17_17_/_0.88)_100%)]"
          aria-hidden
        />

        <Container className="relative z-[2] flex min-h-[inherit] flex-col justify-end py-12 md:py-16">
          <div className="max-w-2xl space-y-4">
            <p className="ck-overline text-ck-yellow">{current.eyebrow}</p>
            <h2
              key={`${current.id}-title`}
              className="ck-display-md max-w-[18ch] text-balance text-ck-text"
            >
              {current.title}
            </h2>
            <p className="ck-body max-w-prose text-ck-text-secondary">{current.description}</p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button href={current.href} variant="primary">
                {current.ctaLabel}
              </Button>
              <Button href="/maratones" variant="secondary">
                Ver todas
              </Button>
            </div>
          </div>

          {count > 1 ? (
            <div className="mt-10 flex items-center gap-3">
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
                    aria-label={`Ir al destacado ${i + 1}`}
                    className={[
                      "h-2.5 w-2.5 rounded-full transition-colors",
                      i === index ? "bg-ck-yellow" : "bg-ck-border hover:bg-ck-text-muted",
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
              <Link
                href={current.href}
                className="ck-caption ml-auto text-ck-text-muted underline-offset-4 hover:text-ck-yellow hover:underline"
              >
                {current.kind === "edition" ? "Ir a la edición" : "Leer más"}
              </Link>
            </div>
          ) : null}
        </Container>
      </div>
    </section>
  );
}
