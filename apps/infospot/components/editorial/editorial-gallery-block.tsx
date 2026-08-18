"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { ResolvedGallery } from "@/lib/editorial-gallery/resolve-gallery";
import { ProtectedEditorialImage } from "@/components/editorial-photos/protected-editorial-image";

type Props = {
  gallery: ResolvedGallery;
};

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/** Distancia circular mínima entre dos índices (para precarga con loop). */
function circularDistance(a: number, b: number, length: number): number {
  const diff = Math.abs(a - b);
  return Math.min(diff, length - diff);
}

/**
 * Slideshow público del bloque "editorialGallery": transición lateral,
 * autoplay con pausas honestas, teclado y swipe, sin descargar todas las
 * imágenes de una — solo la activa y sus vecinas inmediatas.
 */
export function EditorialGalleryBlock({ gallery }: Props) {
  const { images, loop } = gallery;
  const count = images.length;
  const reducedMotion = useReducedMotion();
  const autoplay = gallery.autoplay && !reducedMotion && count > 1;

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [tabVisible, setTabVisible] = useState(true);
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const touchStartX = useRef<number | null>(null);
  const rootId = useId();
  const liveRegionId = `${rootId}-live`;

  useEffect(() => {
    function onVisibility() {
      setTabVisible(document.visibilityState === "visible");
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const goTo = useCallback(
    (next: number) => {
      if (count === 0) return;
      if (loop) {
        setIndex(((next % count) + count) % count);
      } else {
        setIndex(Math.min(count - 1, Math.max(0, next)));
      }
    },
    [count, loop],
  );

  const goNext = useCallback(() => goTo(index + 1), [goTo, index]);
  const goPrev = useCallback(() => goTo(index - 1), [goTo, index]);

  // Autoplay: se reprograma cada vez que cambia el índice, así cualquier
  // navegación (manual o automática) reinicia el temporizador desde cero.
  useEffect(() => {
    if (!autoplay || paused || noticeOpen || !tabVisible) return;
    const timer = setTimeout(() => {
      if (!loop && index >= count - 1) return;
      goTo(index + 1);
    }, gallery.intervalMs);
    return () => clearTimeout(timer);
  }, [autoplay, paused, noticeOpen, tabVisible, index, count, loop, gallery.intervalMs, goTo]);

  if (count === 0) return null;

  const active = images[index]!;
  const activeFailed = failed.has(active.id) || !active.src;

  return (
    <figure className="my-8" data-testid="editorial-gallery-block">
      {gallery.title ? (
        <h3 className="is-title-section mb-2 text-xl">{gallery.title}</h3>
      ) : null}
      <div
        role="group"
        aria-roledescription="carrusel"
        aria-label={gallery.title || "Galería de fotos"}
        tabIndex={0}
        className="relative overflow-hidden rounded-[var(--is-radius-md)] bg-[var(--is-bg-secondary)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--is-accent)]"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") {
            e.preventDefault();
            goPrev();
          } else if (e.key === "ArrowRight") {
            e.preventDefault();
            goNext();
          }
        }}
        onTouchStart={(e) => {
          touchStartX.current = e.changedTouches[0]?.clientX ?? null;
        }}
        onTouchEnd={(e) => {
          const start = touchStartX.current;
          const end = e.changedTouches[0]?.clientX;
          touchStartX.current = null;
          if (start == null || end == null) return;
          const delta = end - start;
          if (Math.abs(delta) < 48) return;
          if (delta < 0) goNext();
          else goPrev();
        }}
      >
        <div
          className="flex w-full"
          style={{
            transform: `translateX(-${index * 100}%)`,
            transition: reducedMotion ? "none" : "transform 420ms ease",
          }}
        >
          {images.map((img, i) => {
            const distance = circularDistance(i, index, count);
            const shouldLoad = distance <= 1;
            const isFailed = failed.has(img.id) || !img.src;

            return (
              <div
                key={img.id}
                className="relative aspect-[16/10] w-full shrink-0 grow-0 basis-full sm:aspect-[16/9]"
                aria-hidden={i !== index}
              >
                {isFailed ? (
                  <div className="flex h-full w-full items-center justify-center bg-[var(--is-bg-secondary)] text-sm text-[var(--is-muted)]">
                    Imagen no disponible
                  </div>
                ) : shouldLoad ? (
                  <ProtectedEditorialImage
                    photographerName={img.photographerName}
                    credit={img.credit}
                    purchaseHref={img.purchaseHref}
                    onNoticeChange={i === index ? setNoticeOpen : undefined}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.src ?? undefined}
                      alt={img.alt}
                      className="h-full w-full object-contain"
                      draggable={false}
                      loading={i === index ? "eager" : "lazy"}
                      decoding="async"
                      width={img.width}
                      height={img.height}
                      onError={() =>
                        setFailed((prev) => {
                          const next = new Set(prev);
                          next.add(img.id);
                          return next;
                        })
                      }
                    />
                  </ProtectedEditorialImage>
                ) : (
                  <div className="h-full w-full bg-[var(--is-bg-secondary)]" aria-hidden />
                )}
              </div>
            );
          })}
        </div>

        {count > 1 ? (
          <>
            <button
              type="button"
              onClick={goPrev}
              disabled={!loop && index === 0}
              aria-label="Foto anterior"
              className="absolute inset-y-0 left-0 flex min-h-11 min-w-11 items-center justify-center bg-gradient-to-r from-black/30 to-transparent px-2 text-white focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-white disabled:cursor-not-allowed disabled:opacity-30"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={goNext}
              disabled={!loop && index === count - 1}
              aria-label="Foto siguiente"
              className="absolute inset-y-0 right-0 flex min-h-11 min-w-11 items-center justify-center bg-gradient-to-l from-black/30 to-transparent px-2 text-white focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-white disabled:cursor-not-allowed disabled:opacity-30"
            >
              ›
            </button>

            <button
              type="button"
              onClick={() => setPaused((p) => !p)}
              aria-pressed={paused}
              aria-label={paused ? "Reanudar reproducción automática" : "Pausar reproducción automática"}
              className="absolute right-2 top-2 min-h-9 min-w-9 rounded bg-black/40 px-2 text-xs text-white focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-white"
            >
              {paused ? "▶" : "❚❚"}
            </button>

            <div
              id={liveRegionId}
              aria-live="polite"
              className="absolute bottom-2 left-2 rounded bg-black/50 px-2 py-1 text-xs font-medium text-white tabular-nums"
            >
              {index + 1} de {count}
            </div>

            <div className="absolute bottom-2 right-2 flex gap-1.5">
              {images.map((img, i) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => goTo(i)}
                  aria-label={`Ir a la foto ${i + 1} de ${count}`}
                  aria-current={i === index}
                  className={`h-2.5 w-2.5 rounded-full focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-white ${
                    i === index ? "bg-white" : "bg-white/40"
                  }`}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>

      {!activeFailed && (active.caption || active.credit || active.purchaseHref) ? (
        <figcaption className="mt-3 space-y-1 text-sm">
          {active.caption ? (
            <p className="text-[var(--is-text-secondary)]">{active.caption}</p>
          ) : null}
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            {active.credit ? (
              <span className="text-[var(--is-muted)]">{active.credit}</span>
            ) : null}
            {active.purchaseHref ? (
              <a
                href={active.purchaseHref}
                rel="noopener noreferrer"
                className="font-semibold text-[var(--is-accent)] hover:underline"
              >
                Comprar fotos
              </a>
            ) : null}
          </div>
        </figcaption>
      ) : null}
      {gallery.caption ? (
        <p className="mt-2 text-sm text-[var(--is-text-secondary)]">{gallery.caption}</p>
      ) : null}
    </figure>
  );
}
