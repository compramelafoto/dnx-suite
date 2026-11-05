"use client";

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type TouchEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  heroTitleSegments,
  type HeroBlockConfig,
  type HeroContentPosition,
  type HeroHeightPreset,
  type HeroImageFocus,
  type HeroOverlayPreset,
  type HeroSlideAlign,
} from "@/lib/website/blocks";
import { useHeroEditingSlideId } from "@/lib/website/hero-editing-context";
import { enlaceDeBoton } from "@/lib/website/button-href";
import { mergeHeroBlogSlides, type HeroRenderSlide } from "@/lib/website/blog-banner";
import type { WebsiteDynamicData } from "@/lib/website/dynamic-data";
import { levelStyle } from "@/lib/website/typography";

const HEIGHT_CLASS: Record<HeroHeightPreset, string> = {
  compact: "min-h-[240px] sm:min-h-[320px]",
  normal: "min-h-[320px] sm:min-h-[420px]",
  large: "min-h-[420px] sm:min-h-[560px]",
  screen: "min-h-[70vh] sm:min-h-screen",
};

/** `medium` = 0.45, el mismo valor fijo que tenía el overlay del Hero de una sola placa antes de
 * esta etapa — así una placa migrada de un Hero viejo con imagen se ve igual. */
const OVERLAY_ALPHA: Record<HeroOverlayPreset, number> = { none: 0, soft: 0.25, medium: 0.45, dark: 0.65 };

const CONTENT_JUSTIFY: Record<HeroContentPosition, string> = { top: "justify-start", center: "justify-center", bottom: "justify-end" };
const ALIGN_CLASS: Record<HeroSlideAlign, string> = { left: "items-start text-left", center: "items-center text-center", right: "items-end text-right" };
const OBJECT_POSITION: Record<HeroImageFocus, string> = { center: "center", top: "top", bottom: "bottom", left: "left", right: "right" };

/** Subrayado a mano de las palabras del título marcadas con asteriscos. */
function TituloConAcentos({ title }: { title: string }) {
  return (
    <>
      {heroTitleSegments(title).map((seg, i) =>
        seg.accent ? (
          <span key={i} className="relative inline-block whitespace-nowrap">
            {seg.text}
            <svg
              aria-hidden="true"
              viewBox="0 0 200 16"
              preserveAspectRatio="none"
              className="pointer-events-none absolute -bottom-[0.12em] left-[-2%] h-[0.32em] w-[104%]"
            >
              <path
                d="M3 11 C 40 6, 90 4, 130 6 S 185 9, 197 5"
                fill="none"
                stroke="var(--wsite-accent)"
                strokeWidth="2.6"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </span>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </>
  );
}

/** Preset interno de duración de transición (pedido: nunca exponer milisegundos técnicos al
 * usuario). `prefers-reduced-motion` la lleva a 0 — cambio inmediato, sin movimiento. */
const TRANSITION_MS = 500;

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return reduced;
}

/**
 * Hero / Banner — 1 placa se comporta exactamente como el Hero de siempre (sin flechas, sin
 * indicadores, sin timer). 2+ placas se convierten automáticamente en carrusel. Mismo componente
 * para el builder (`LivePreview`) y para cualquier renderer futuro del sitio público —
 * `useHeroEditingSlideId` solo tiene efecto si hay un `HeroEditingProvider` arriba (el builder);
 * en cualquier otro árbol (incluida esta etapa, que todavía no conecta el sitio público) es un
 * no-op y el carrusel se comporta con su autoplay normal.
 */
export function HeroBlockView({ config, blockId, data }: { config: HeroBlockConfig; blockId?: string; data?: WebsiteDynamicData }) {
  // Los artículos que el blog destacó en este banner (solo en el sitio publicado: el builder no
  // recibe `data`). Se intercalan con las placas propias en el número que eligió cada uno.
  const heroBlog = data?.heroBlog && data.heroBlog.blockId === blockId ? data.heroBlog.slides : null;
  const slides: HeroRenderSlide[] = heroBlog ? mergeHeroBlogSlides(config.slides, heroBlog) : config.slides;
  const forcedSlideId = useHeroEditingSlideId(blockId ?? "");
  const reducedMotion = usePrefersReducedMotion();
  const [activeIndex, setActiveIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [tabVisible, setTabVisible] = useState(true);
  const touchStartX = useRef<number | null>(null);

  const isCarousel = slides.length > 1;
  // Con una sola placa, va en el flujo de la página: si el contenido (logo, figura en el celular)
  // es más alto que el mínimo del banner, el banner crece en vez de cortarlo. En el carrusel las
  // placas se apilan una sobre otra y necesitan ir posicionadas.
  const enFlujo = !isCarousel;
  // Foto entera: la altura la da la propia foto, así que no se impone el alto mínimo del banner.
  const esEntera = (slide: HeroRenderSlide) => enFlujo && slide.imageLayout === "whole" && !!slide.imageUrl;
  const forcedIndex = forcedSlideId ? slides.findIndex((s) => s.id === forcedSlideId) : -1;
  const effectiveIndex = forcedIndex >= 0 ? forcedIndex : Math.min(activeIndex, Math.max(slides.length - 1, 0));

  useEffect(() => {
    function onVisibility() {
      setTabVisible(!document.hidden);
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // Si se elimina la placa activa (queda un índice fuera de rango), reencuadra al último válido.
  useEffect(() => {
    setActiveIndex((i) => Math.min(i, Math.max(slides.length - 1, 0)));
  }, [slides.length]);

  useEffect(() => {
    if (!isCarousel || !config.autoplay || forcedIndex >= 0) return;
    if (config.pauseOnHover && hovered) return;
    if (!tabVisible) return;
    const timer = setInterval(() => {
      setActiveIndex((i) => {
        if (i >= slides.length - 1) return config.loop ? 0 : i;
        return i + 1;
      });
    }, config.intervalMs);
    return () => clearInterval(timer);
  }, [isCarousel, config.autoplay, config.pauseOnHover, config.intervalMs, config.loop, hovered, tabVisible, slides.length, forcedIndex]);

  if (slides.length === 0) return null;

  const transitionMs = reducedMotion ? 0 : TRANSITION_MS;
  const useSlideEffect = config.transition === "slide" && !reducedMotion;
  const atFirst = effectiveIndex === 0;
  const atLast = effectiveIndex === slides.length - 1;

  function jumpTo(index: number) {
    setActiveIndex(Math.max(0, Math.min(index, slides.length - 1)));
  }
  function next() {
    if (!config.loop && atLast) return;
    setActiveIndex(config.loop ? (effectiveIndex + 1) % slides.length : Math.min(effectiveIndex + 1, slides.length - 1));
  }
  function prev() {
    if (!config.loop && atFirst) return;
    setActiveIndex(config.loop ? (effectiveIndex - 1 + slides.length) % slides.length : Math.max(effectiveIndex - 1, 0));
  }

  function handleKeyDown(e: KeyboardEvent<HTMLElement>) {
    if (!isCarousel) return;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      prev();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      next();
    }
  }
  function handleTouchStart(e: TouchEvent<HTMLElement>) {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  }
  function handleTouchEnd(e: TouchEvent<HTMLElement>) {
    if (touchStartX.current === null) return;
    const endX = e.changedTouches[0]?.clientX ?? touchStartX.current;
    const delta = endX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < 40) return;
    if (delta < 0) next();
    else prev();
  }

  return (
    <section
      className={`relative overflow-hidden ${slides[0] && esEntera(slides[0]) ? "" : HEIGHT_CLASS[config.heightPreset]}`}
      style={{ backgroundColor: "var(--wsite-secondary)" }}
      role={isCarousel ? "region" : undefined}
      aria-roledescription={isCarousel ? "carrusel" : undefined}
      aria-label={isCarousel ? "Banner principal" : undefined}
      tabIndex={isCarousel ? 0 : undefined}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {slides.map((slide, index) => {
        const isActive = index === effectiveIndex;
        const style: CSSProperties = useSlideEffect
          ? { transform: `translateX(${(index - effectiveIndex) * 100}%)`, transition: `transform ${transitionMs}ms ease` }
          : { opacity: isActive ? 1 : 0, transition: `opacity ${transitionMs}ms ease` };
        // Las placas apiladas e invisibles no deben tapar los clics de la que se ve.
        if (!isActive) style.pointerEvents = "none";
        const slideHref = enlaceDeBoton(slide.href);
        const oscuro = slide.textTone === "dark";
        const entera = esEntera(slide);
        const href = slide.showButton && slide.buttonLabel ? enlaceDeBoton(slide.buttonUrl, data?.paginasDelSitio) : null;
        const href2 = slide.showSecondaryButton && slide.secondaryButtonLabel ? enlaceDeBoton(slide.secondaryButtonUrl, data?.paginasDelSitio) : null;
        // Sobre la foto, el contorno va en blanco; sobre fondo claro, en el color del sitio.
        const contorno = oscuro ? "var(--wsite-primary)" : "#ffffff";
        const estiloBoton = (variante: "solid" | "outline"): CSSProperties => ({
          ...levelStyle("button", { color: false }),
          borderRadius: "var(--wsite-button-radius)",
          paddingInline: "var(--wsite-button-padding-x)",
          paddingBlock: "var(--wsite-button-padding-y)",
          ...(variante === "solid"
            ? { backgroundColor: "var(--wsite-accent)", color: "#ffffff" }
            : { border: `2px solid ${contorno}`, color: contorno }),
        });
        return (
          <div
            key={slide.id}
            className={enFlujo ? "relative flex flex-col" : "absolute inset-0"}
            style={enFlujo ? { ...style, minHeight: "inherit" } : style}
            aria-hidden={!isActive}
          >
            <div
              className="absolute inset-0"
              style={{
                backgroundColor: "var(--wsite-secondary)",
                backgroundImage: slide.imageUrl && !entera ? `url(${slide.imageUrl})` : undefined,
                backgroundSize: "cover",
                backgroundPosition: OBJECT_POSITION[slide.imageFocus],
              }}
            />
            <div className="absolute inset-0" style={{ background: `rgba(15, 23, 42, ${OVERLAY_ALPHA[slide.overlay]})` }} />
            {slide.figureUrl ? (
              // Desde tablet, la figura se apoya abajo a la derecha, delante del fondo.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={slide.figureUrl}
                alt={slide.figureAlt ?? ""}
                className="pointer-events-none absolute bottom-0 right-[3%] hidden h-[92%] max-w-[46%] object-contain object-bottom md:block"
              />
            ) : null}
            {slideHref ? (
              // La placa entera lleva al artículo. Fuera del orden de tabulación: el botón ya es
              // el camino con teclado, y dos enlaces seguidos al mismo lugar molestan.
              <a href={slideHref} className="absolute inset-0" tabIndex={-1} aria-hidden="true" />
            ) : null}
            <div
              className={`relative flex flex-1 flex-col gap-4 w-full ${
                entera
                  ? // Con la foto entera, desde la computadora el texto se apoya sobre la mitad izquierda.
                    "px-6 py-12 xl:absolute xl:inset-y-0 xl:left-0 xl:w-[54%] xl:pb-[2%] xl:pt-[6%] xl:pl-[7%] xl:pr-0"
                  : `px-6 py-16 sm:py-20 mx-auto ${slide.figureUrl ? "max-w-6xl" : "h-full max-w-4xl"}`
              } ${CONTENT_JUSTIFY[slide.contentPosition]} ${ALIGN_CLASS[slide.align]} ${slideHref ? "pointer-events-none [&_a]:pointer-events-auto" : ""}`}
            >
              <div className={`flex flex-col gap-4 ${ALIGN_CLASS[slide.align]} ${slide.figureUrl && !entera ? "md:max-w-[52%]" : "w-full"}`}>
                {slide.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={slide.logoUrl} alt="Logo" className="mb-2 h-auto w-60 max-w-full sm:w-80" />
                ) : null}
                {/* Sobre la foto, título y subtítulo van en blanco; con texto oscuro, en los colores del sitio. */}
                <h1
                  className={oscuro ? undefined : "text-white"}
                  style={{ ...levelStyle("title", { color: oscuro }), textWrap: "balance", letterSpacing: "var(--wsite-letter-spacing)" }}
                >
                  <TituloConAcentos title={slide.title || "Título principal"} />
                </h1>
                {slide.subtitle ? (
                  <p
                    // La bajada de un artículo puede ser larga: tres renglones y "…".
                    className={`max-w-2xl leading-relaxed whitespace-pre-line ${oscuro ? "" : "text-white/90"} ${slideHref ? "line-clamp-3" : ""}`}
                    style={{ ...levelStyle("subtitle", { color: oscuro }), ...(oscuro ? { opacity: 0.88 } : {}) }}
                  >
                    {slide.subtitle}
                  </p>
                ) : null}
                {href || href2 ? (
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    {href ? (
                      <a href={href} className="inline-flex transition-transform hover:scale-[1.02]" style={estiloBoton(slide.buttonStyle)}>
                        {slide.buttonLabel}
                      </a>
                    ) : null}
                    {href2 ? (
                      <a href={href2} className="inline-flex transition-transform hover:scale-[1.02]" style={estiloBoton("outline")}>
                        {slide.secondaryButtonLabel}
                      </a>
                    ) : null}
                  </div>
                ) : null}
              </div>
              {slide.figureUrl ? (
                // En el celular, la figura va debajo del texto, entera.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={slide.figureUrl}
                  alt=""
                  aria-hidden="true"
                  className="-mb-16 mx-auto mt-2 h-auto max-h-[420px] w-auto max-w-full object-contain sm:-mb-20 md:hidden"
                />
              ) : null}
            </div>
            {entera ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={slide.imageUrl} alt={slide.imageAlt ?? ""} className="relative block h-auto w-full" />
            ) : null}
          </div>
        );
      })}

      {isCarousel && config.showArrows ? (
        <>
          <button
            type="button"
            aria-label="Placa anterior"
            onClick={prev}
            disabled={!config.loop && atFirst}
            className="absolute left-2 sm:left-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/30 p-2 text-white transition-colors hover:bg-black/50 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Placa siguiente"
            onClick={next}
            disabled={!config.loop && atLast}
            className="absolute right-2 sm:right-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/30 p-2 text-white transition-colors hover:bg-black/50 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </>
      ) : null}

      {isCarousel && config.showIndicators ? (
        <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2">
          {slides.map((slide, index) => (
            <button
              key={slide.id}
              type="button"
              aria-label={`Ir a la placa ${index + 1}`}
              aria-current={index === effectiveIndex}
              onClick={() => jumpTo(index)}
              className="h-2 rounded-full transition-all"
              style={{ width: index === effectiveIndex ? 20 : 8, backgroundColor: index === effectiveIndex ? "#ffffff" : "rgba(255,255,255,0.5)" }}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
