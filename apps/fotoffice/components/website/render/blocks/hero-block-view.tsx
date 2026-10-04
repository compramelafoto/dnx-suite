"use client";

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type TouchEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { HeroBlockConfig, HeroContentPosition, HeroHeightPreset, HeroImageFocus, HeroOverlayPreset, HeroSlideAlign } from "@/lib/website/blocks";
import { useHeroEditingSlideId } from "@/lib/website/hero-editing-context";
import { enlaceDeBoton } from "@/lib/website/button-href";
import { levelStyle } from "@/lib/website/typography";
import type { WebsiteDynamicData } from "@/lib/website/dynamic-data";
import { resolveHeroSlides, type ResolvedHeroSlide } from "@/lib/website/hero-slides";

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
  // Las placas que destacan un artículo que ya no está publicado se saltean (ver `resolveHeroSlides`).
  const resolved = resolveHeroSlides(config.slides, data);
  const slides = resolved.map((r) => r.slide);
  const forcedSlideId = useHeroEditingSlideId(blockId ?? "");
  const reducedMotion = usePrefersReducedMotion();
  const [activeIndex, setActiveIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [tabVisible, setTabVisible] = useState(true);
  const touchStartX = useRef<number | null>(null);

  const isCarousel = slides.length > 1;
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
      className={`relative overflow-hidden ${HEIGHT_CLASS[config.heightPreset]}`}
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
      {resolved.map((item, index) => {
        const isActive = index === effectiveIndex;
        const style: CSSProperties = useSlideEffect
          ? { transform: `translateX(${(index - effectiveIndex) * 100}%)`, transition: `transform ${transitionMs}ms ease` }
          : { opacity: isActive ? 1 : 0, transition: `opacity ${transitionMs}ms ease` };
        return (
          <div key={item.slide.id} className="absolute inset-0" style={style} aria-hidden={!isActive}>
            {item.kind === "blogPost" ? (
              <BlogPostSlide item={item} isActive={isActive} withIndicators={isCarousel && config.showIndicators} />
            ) : (
              <ManualSlide slide={item.slide} />
            )}
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

function SlideBackground({ imageUrl, focus }: { imageUrl: string | null | undefined; focus: HeroImageFocus }) {
  return (
    <div
      className="absolute inset-0"
      style={{
        backgroundColor: "var(--wsite-secondary)",
        backgroundImage: imageUrl ? `url(${imageUrl})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: OBJECT_POSITION[focus],
      }}
    />
  );
}

function ManualSlide({ slide }: { slide: ResolvedHeroSlide["slide"] }) {
  return (
    <>
      <SlideBackground imageUrl={slide.imageUrl} focus={slide.imageFocus} />
      <div className="absolute inset-0" style={{ background: `rgba(15, 23, 42, ${OVERLAY_ALPHA[slide.overlay]})` }} />
      <div
        className={`relative flex h-full flex-col gap-4 px-6 py-16 sm:py-20 max-w-4xl mx-auto ${CONTENT_JUSTIFY[slide.contentPosition]} ${ALIGN_CLASS[slide.align]}`}
      >
        {/* Sobre la foto, título y subtítulo van siempre en blanco: no toman el color del nivel. */}
        <h1
          className="text-white"
          style={{ ...levelStyle("title", { color: false }), textWrap: "balance", letterSpacing: "var(--wsite-letter-spacing)" }}
        >
          {slide.title || "Título principal"}
        </h1>
        {slide.subtitle ? (
          <p className="max-w-2xl leading-relaxed text-white/90" style={levelStyle("subtitle", { color: false })}>
            {slide.subtitle}
          </p>
        ) : null}
        {slide.showButton && slide.buttonLabel && enlaceDeBoton(slide.buttonUrl) ? (
          <a
            href={enlaceDeBoton(slide.buttonUrl) ?? undefined}
            className="inline-flex mt-2 transition-transform hover:scale-[1.02]"
            style={{
              ...levelStyle("button", { color: false }),
              borderRadius: "var(--wsite-button-radius)",
              paddingInline: "var(--wsite-button-padding-x)",
              paddingBlock: "var(--wsite-button-padding-y)",
              ...(slide.buttonStyle === "solid"
                ? { backgroundColor: "var(--wsite-accent)", color: "#ffffff" }
                : { border: "2px solid #ffffff", color: "#ffffff" }),
            }}
          >
            {slide.buttonLabel}
          </a>
        ) : null}
      </div>
    </>
  );
}

/**
 * Corta el texto en N renglones con "…". Va en el `style` y después de `levelStyle`, que define su
 * propio `display` y le ganaría a la clase `line-clamp` de Tailwind: así pasaba, y el extracto
 * quedaba cortado por la mitad de un renglón.
 */
function recortarEnLineas(lineas: number): CSSProperties {
  return { display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: lineas, overflow: "hidden" };
}

/**
 * Placa que destaca un artículo del blog: la portada de fondo y, abajo, el título y el extracto
 * sobre un degradé que asegura que se lean con cualquier foto. La placa entera es el enlace al
 * artículo — un botón aparte sería un segundo lugar donde apuntar para lo mismo. El margen lateral
 * es más ancho que el de la placa manual porque el texto va alineado a la izquierda, justo donde
 * caen las flechas del carrusel.
 */
function BlogPostSlide({
  item,
  isActive,
  withIndicators,
}: {
  item: Extract<ResolvedHeroSlide, { kind: "blogPost" }>;
  isActive: boolean;
  withIndicators: boolean;
}) {
  const contenido = (
    <>
      <SlideBackground imageUrl={item.imageUrl} focus={item.slide.imageFocus} />
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(to top, rgba(15,23,42,0.88) 0%, rgba(15,23,42,0.55) 35%, rgba(15,23,42,0) 70%)" }}
      />
      <div className={`relative mx-auto flex h-full max-w-4xl flex-col justify-end gap-3 px-12 pt-16 text-left sm:px-16 ${withIndicators ? "pb-14" : "pb-10"} sm:pb-14`}>
        <h2
          className="shrink-0 text-white"
          style={{
            ...levelStyle("title", { color: false }),
            ...recortarEnLineas(3),
            textWrap: "balance",
            letterSpacing: "var(--wsite-letter-spacing)",
          }}
        >
          {item.title}
        </h2>
        {item.excerpt ? (
          <p className="max-w-2xl shrink-0 leading-relaxed text-white/90" style={{ ...levelStyle("subtitle", { color: false }), ...recortarEnLineas(3) }}>
            {item.excerpt}
          </p>
        ) : null}
        {item.href ? (
          <span className="mt-1 text-sm font-semibold text-white underline-offset-4 group-hover:underline">Leer artículo →</span>
        ) : null}
      </div>
    </>
  );

  if (!item.href) return <div className="absolute inset-0">{contenido}</div>;
  return (
    <a href={item.href} className="group absolute inset-0 block" tabIndex={isActive ? undefined : -1} aria-label={`Leer el artículo: ${item.title}`}>
      {contenido}
    </a>
  );
}
