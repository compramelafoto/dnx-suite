"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import {
  EDITION_COVER_HORIZONTAL,
  EDITION_COVER_VERTICAL,
} from "@/lib/admin/editions/cover-specs";
import {
  DEFAULT_HOME_BANNER_CAROUSEL,
  type HomeBannerCarouselConfig,
} from "@/lib/admin/home-banners/types";

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

const SWIPE_THRESHOLD_PX = 48;
/** Frase grande visible al pasar el mouse (~1s). */
const HOVER_HINT_MS = 1000;

type Props = {
  slides: HomeSpotlightSlide[];
  carousel?: HomeBannerCarouselConfig;
};

export function HomeSpotlightBanner({
  slides,
  carousel = DEFAULT_HOME_BANNER_CAROUSEL,
}: Props) {
  const router = useRouter();
  const items = slides.filter(Boolean);
  const count = items.length;
  const autoplayMs = carousel.autoplayMs;
  const transitionMs = carousel.transitionMs;
  const autoplayEnabled = carousel.autoplayEnabled;

  /** Posición en el track extendido [0..count] (count = clon del primero). */
  const [position, setPosition] = useState(0);
  const [withTransition, setWithTransition] = useState(true);
  const [paused, setPaused] = useState(false);
  const [progressKey, setProgressKey] = useState(0);
  const [hintVisible, setHintVisible] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const swipedRef = useRef(false);
  const hintTimerRef = useRef<number | null>(null);
  const jumpingRef = useRef(false);

  const logicalIndex = count > 0 ? ((position % count) + count) % count : 0;
  const current = items[logicalIndex] ?? null;
  const trackSlides = count > 1 ? [...items, items[0]!] : items;

  const clearHintTimer = useCallback(() => {
    if (hintTimerRef.current != null) {
      window.clearTimeout(hintTimerRef.current);
      hintTimerRef.current = null;
    }
  }, []);

  const showHintBriefly = useCallback(() => {
    clearHintTimer();
    setHintVisible(true);
    hintTimerRef.current = window.setTimeout(() => {
      setHintVisible(false);
      hintTimerRef.current = null;
    }, HOVER_HINT_MS);
  }, [clearHintTimer]);

  const bumpProgress = useCallback(() => {
    setProgressKey((k) => k + 1);
  }, []);

  const goNext = useCallback(() => {
    if (count <= 1 || jumpingRef.current) return;
    setWithTransition(true);
    setPosition((p) => p + 1);
    bumpProgress();
  }, [count, bumpProgress]);

  const goPrev = useCallback(() => {
    if (count <= 1 || jumpingRef.current) return;
    if (position === 0) {
      // Saltar sin animación al clon final, luego deslizar al penúltimo.
      jumpingRef.current = true;
      setWithTransition(false);
      setPosition(count);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setWithTransition(true);
          setPosition(count - 1);
          jumpingRef.current = false;
          bumpProgress();
        });
      });
      return;
    }
    setWithTransition(true);
    setPosition((p) => p - 1);
    bumpProgress();
  }, [count, position, bumpProgress]);

  const goToIndex = useCallback(
    (target: number) => {
      if (count <= 1 || jumpingRef.current) return;
      const next = ((target % count) + count) % count;
      setWithTransition(true);
      setPosition(next);
      bumpProgress();
    },
    [count, bumpProgress],
  );

  const onTrackTransitionEnd = useCallback(() => {
    if (count <= 1) return;
    if (position >= count) {
      jumpingRef.current = true;
      setWithTransition(false);
      setPosition(0);
      requestAnimationFrame(() => {
        jumpingRef.current = false;
      });
    }
  }, [count, position]);

  useEffect(() => {
    if (!autoplayEnabled || count <= 1 || paused) return;
    const id = window.setInterval(() => {
      goNext();
    }, autoplayMs);
    return () => window.clearInterval(id);
  }, [autoplayEnabled, autoplayMs, count, paused, goNext]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (event.key === "ArrowRight") {
        event.preventDefault();
        goNext();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        goPrev();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goPrev]);

  useEffect(() => () => clearHintTimer(), [clearHintTimer]);

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
      className="relative max-w-[100vw] overflow-x-clip border-b border-ck-border bg-ck-bg"
      aria-roledescription="carousel"
      aria-label="Destacados Clickatón"
      onMouseEnter={() => {
        setPaused(true);
        showHintBriefly();
      }}
      onMouseLeave={() => {
        setPaused(false);
        clearHintTimer();
        setHintVisible(false);
      }}
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
        showHintBriefly();
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
        if (delta < 0) goNext();
        else goPrev();
        window.setTimeout(() => {
          swipedRef.current = false;
        }, 350);
      }}
    >
      <div className="relative w-full aspect-[9/16] max-h-[min(85vh,42rem)] overflow-hidden md:aspect-video md:max-h-none">
        <div
          className="flex h-full w-full will-change-transform"
          style={{
            transform: `translate3d(-${position * 100}%, 0, 0)`,
            transition: withTransition
              ? `transform ${transitionMs}ms cubic-bezier(0.22, 1, 0.36, 1)`
              : "none",
          }}
          onTransitionEnd={onTrackTransitionEnd}
        >
          {trackSlides.map((slide, i) => {
            const desktopSrc = slide.imageUrl || slide.imageUrlVertical;
            const mobileSrc = slide.imageUrlVertical || slide.imageUrl;
            const isClone = count > 1 && i === trackSlides.length - 1;
            return (
              <div
                key={isClone ? `${slide.id}-clone` : slide.id}
                className="relative h-full w-full shrink-0 grow-0 basis-full"
                aria-hidden={i !== position && !(position >= count && i === 0)}
              >
                {desktopSrc ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={desktopSrc}
                      alt=""
                      width={EDITION_COVER_HORIZONTAL.width}
                      height={EDITION_COVER_HORIZONTAL.height}
                      className={[
                        "absolute inset-0 hidden h-full w-full object-cover object-center transition-opacity duration-500 md:block",
                        hintVisible ? "opacity-40" : "opacity-100",
                      ].join(" ")}
                      loading={i === 0 ? "eager" : "lazy"}
                      draggable={false}
                    />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={mobileSrc || desktopSrc}
                      alt=""
                      width={EDITION_COVER_VERTICAL.width}
                      height={EDITION_COVER_VERTICAL.height}
                      className={[
                        "absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-500 md:hidden",
                        hintVisible ? "opacity-40" : "opacity-100",
                      ].join(" ")}
                      loading={i === 0 ? "eager" : "lazy"}
                      draggable={false}
                    />
                  </>
                ) : (
                  <div
                    className={[
                      "absolute inset-0 bg-[linear-gradient(145deg,#2a2418_0%,#121212_45%,#0a0a0a_100%)] transition-opacity duration-500",
                      hintVisible ? "opacity-40" : "opacity-100",
                    ].join(" ")}
                    aria-hidden
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Todo el banner es el enlace */}
        <button
          type="button"
          className="absolute inset-0 z-[1] cursor-pointer bg-transparent"
          aria-label={current.ctaLabel}
          onClick={navigateToCurrent}
        />

        {/* Frase grande centrada (~1s al hover); no es un botón */}
        <div
          className={[
            "pointer-events-none absolute inset-0 z-[2] flex items-center justify-center px-6 transition-opacity duration-500",
            hintVisible ? "opacity-100" : "opacity-0",
          ].join(" ")}
          aria-hidden={!hintVisible}
        >
          <p className="max-w-4xl text-center font-sans text-3xl font-semibold leading-[1.15] tracking-tight text-ck-yellow drop-shadow-[0_2px_24px_rgba(0,0,0,0.75)] sm:text-4xl md:text-5xl lg:text-6xl">
            {current.ctaLabel}
          </p>
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
                    goPrev();
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
                      aria-selected={i === logicalIndex}
                      aria-label={slide.title}
                      title={slide.title}
                      className={[
                        "h-2.5 rounded-full transition-all",
                        i === logicalIndex
                          ? "w-7 bg-ck-yellow"
                          : "w-2.5 bg-ck-border hover:bg-ck-text-muted",
                      ].join(" ")}
                      onClick={(e) => {
                        e.stopPropagation();
                        goToIndex(i);
                      }}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  className="ck-caption rounded border border-ck-border px-3 py-1.5 text-ck-text-secondary hover:border-ck-yellow hover:text-ck-yellow"
                  onClick={(e) => {
                    e.stopPropagation();
                    goNext();
                  }}
                  aria-label="Banner siguiente"
                >
                  →
                </button>
              </div>
              {autoplayEnabled ? (
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
                    style={
                      paused
                        ? undefined
                        : ({ animationDuration: `${autoplayMs}ms` } satisfies CSSProperties)
                    }
                  />
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
