"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
  imageUrl?: string;
  imageUrlVertical?: string;
};

const AUTOPLAY_MS = 3000;
const SWIPE_THRESHOLD_PX = 48;

type Props = {
  slides: HomeSpotlightSlide[];
};

export function HomeSpotlightBanner({ slides }: Props) {
  const router = useRouter();
  const items = slides.filter(Boolean);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [progressKey, setProgressKey] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const swipedRef = useRef(false);
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

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (event.key === "ArrowRight") {
        event.preventDefault();
        goTo(index + 1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        goTo(index - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goTo, index]);

  if (!current) return null;

  function navigateToCurrent() {
    if (!current || swipedRef.current) return;
    const href = current.href;
    if (href.startsWith("http://") || href.startsWith("https://")) {
      window.open(href, "_blank", "noopener,noreferrer");
      return;
    }
    router.push(href);
  }

  return (
    <section
      className="group relative max-w-[100vw] overflow-x-clip border-b border-ck-border bg-ck-bg"
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
      onTouchStart={(e) => {
        touchStartX.current = e.changedTouches[0]?.clientX ?? null;
        swipedRef.current = false;
        setPaused(true);
      }}
      onTouchEnd={(e) => {
        const start = touchStartX.current;
        const end = e.changedTouches[0]?.clientX;
        touchStartX.current = null;
        setPaused(false);
        if (start == null || end == null || count <= 1) return;
        const delta = end - start;
        if (Math.abs(delta) < SWIPE_THRESHOLD_PX) return;
        swipedRef.current = true;
        if (delta < 0) goTo(index + 1);
        else goTo(index - 1);
        window.setTimeout(() => {
          swipedRef.current = false;
        }, 350);
      }}
    >
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
                    className="absolute inset-0 hidden h-full w-full object-cover object-center opacity-100 transition-opacity duration-300 group-hover:opacity-40 md:block"
                    loading={i === 0 ? "eager" : "lazy"}
                    draggable={false}
                  />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={mobileSrc || desktopSrc}
                    alt=""
                    width={EDITION_COVER_VERTICAL.width}
                    height={EDITION_COVER_VERTICAL.height}
                    className="absolute inset-0 h-full w-full object-cover object-center opacity-100 transition-opacity duration-300 group-hover:opacity-40 md:hidden"
                    loading={i === 0 ? "eager" : "lazy"}
                    draggable={false}
                  />
                </>
              ) : (
                <div
                  className="absolute inset-0 bg-[linear-gradient(145deg,#2a2418_0%,#121212_45%,#0a0a0a_100%)] opacity-100 transition-opacity duration-300 group-hover:opacity-40"
                  aria-hidden
                />
              )}
            </div>
          );
        })}

        {/* Capa clicable a pantalla completa → mismo destino del CTA */}
        <button
          type="button"
          className="absolute inset-0 z-[1] cursor-pointer bg-transparent"
          aria-label={current.ctaLabel}
          onClick={navigateToCurrent}
        />

        {/* Un solo botón centrado; visible al hover (desktop) / siempre en móvil */}
        <div className="pointer-events-none absolute inset-0 z-[2] flex items-center justify-center px-6 opacity-100 transition-opacity duration-300 md:opacity-0 md:group-hover:opacity-100">
          <span className="pointer-events-none rounded-[var(--ck-radius-control)] border-2 border-[var(--ck-core-ink-on-brand)] bg-ck-yellow px-8 py-3 text-base font-semibold text-[var(--ck-text-on-brand)] shadow-[var(--ck-shadow-glow)]">
            {current.ctaLabel}
          </span>
        </div>

        <h2 className="sr-only">{current.title}</h2>

        {count > 1 ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-5 z-[3] flex justify-center px-4 md:bottom-7">
            <div className="pointer-events-auto flex flex-col items-center gap-3">
              <div className="flex items-center gap-3 rounded-full border border-ck-border/70 bg-ck-bg/55 px-3 py-2 backdrop-blur-md">
                <button
                  type="button"
                  className="ck-caption rounded border border-ck-border px-3 py-1.5 text-ck-text-secondary hover:border-ck-yellow hover:text-ck-yellow"
                  onClick={(e) => {
                    e.stopPropagation();
                    goTo(index - 1);
                  }}
                  aria-label="Banner anterior"
                >
                  ←
                </button>
                <div className="flex gap-2" role="tablist" aria-label="Banners">
                  {items.map((slide, i) => (
                    <button
                      key={slide.id}
                      type="button"
                      role="tab"
                      aria-selected={i === index}
                      aria-label={slide.title}
                      title={slide.title}
                      className={[
                        "h-2.5 rounded-full transition-all",
                        i === index
                          ? "w-7 bg-ck-yellow"
                          : "w-2.5 bg-ck-border hover:bg-ck-text-muted",
                      ].join(" ")}
                      onClick={(e) => {
                        e.stopPropagation();
                        goTo(i);
                      }}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  className="ck-caption rounded border border-ck-border px-3 py-1.5 text-ck-text-secondary hover:border-ck-yellow hover:text-ck-yellow"
                  onClick={(e) => {
                    e.stopPropagation();
                    goTo(index + 1);
                  }}
                  aria-label="Banner siguiente"
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
