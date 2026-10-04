"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { AUTOPLAY_MS, nextSlideIndex } from "@/lib/testimonials/public/carousel";
import type { PublishedTestimonial } from "@/lib/testimonials/public/list-published";
import {
  authorRoleLabel,
  toInitials,
} from "@/lib/testimonials/public/voices-presentation";

function Avatar({ testimonial }: { testimonial: PublishedTestimonial }) {
  if (testimonial.photoUrl) {
    return (
      <Image
        src={testimonial.photoUrl}
        alt=""
        width={56}
        height={56}
        className="h-14 w-14 shrink-0 rounded-full object-cover"
        unoptimized
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-ck-border bg-ck-surface text-ck-text-secondary"
    >
      {toInitials(testimonial.authorName)}
    </span>
  );
}

function VoiceCard({
  testimonial,
  showEditionName,
}: {
  testimonial: PublishedTestimonial;
  showEditionName: boolean;
}) {
  const meta = [
    authorRoleLabel(testimonial.authorRole),
    showEditionName ? testimonial.editionName : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const body = (
    <>
      <blockquote className="ck-body-lg text-ck-text">
        «{testimonial.excerpt}»
      </blockquote>
      <figcaption className="mt-[var(--ck-stack-content-to-actions)] flex items-center gap-3">
        <Avatar testimonial={testimonial} />
        <span className="flex flex-col">
          <span className="ck-body-md text-ck-text">{testimonial.authorName}</span>
          <span className="ck-caption text-ck-text-muted">{meta}</span>
        </span>
      </figcaption>
    </>
  );

  if (!testimonial.linkUrl) {
    return (
      <Card as="figure" className="flex flex-col">
        {body}
      </Card>
    );
  }

  return (
    <Card as="figure" variant="interactive" className="flex flex-col">
      <a
        href={testimonial.linkUrl}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="flex flex-col focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ck-yellow"
      >
        <span className="sr-only">
          Ver el perfil de {testimonial.authorName} (se abre en otra pestaña)
        </span>
        {body}
      </a>
    </Card>
  );
}

/**
 * Carrusel de testimonios.
 *
 * Usa desplazamiento con anclaje nativo en vez de mover un `transform`: así el
 * gesto táctil es el del sistema, la cantidad visible la decide el CSS según el
 * ancho (uno en el teléfono, tres en el escritorio) y no hay que calcular
 * páginas a mano.
 */
export function VoicesCarousel({
  testimonials,
  showEditionName,
}: {
  testimonials: readonly PublishedTestimonial[];
  showEditionName: boolean;
}) {
  const trackRef = useRef<HTMLUListElement>(null);
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  const goTo = useCallback(
    (index: number, smooth: boolean) => {
      const track = trackRef.current;
      const card = track?.children[index] as HTMLElement | undefined;
      if (!track || !card) return;
      // scrollTo y no scrollIntoView: éste último también mueve la página.
      track.scrollTo({
        left: card.offsetLeft - track.offsetLeft,
        behavior: smooth ? "smooth" : "auto",
      });
      setCurrent(index);
    },
    [],
  );

  useEffect(() => {
    if (paused || reducedMotion || testimonials.length <= 1) return;
    const id = window.setInterval(() => {
      setCurrent((index) => {
        const next = nextSlideIndex(index, testimonials.length);
        goTo(next, true);
        return next;
      });
    }, AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [paused, reducedMotion, testimonials.length, goTo]);

  // Si la persona arrastra con el dedo, los puntos tienen que seguirla.
  function handleScroll() {
    const track = trackRef.current;
    if (!track) return;
    const children = Array.from(track.children) as HTMLElement[];
    let nearest = 0;
    let best = Number.POSITIVE_INFINITY;
    children.forEach((child, index) => {
      const distance = Math.abs(child.offsetLeft - track.offsetLeft - track.scrollLeft);
      if (distance < best) {
        best = distance;
        nearest = index;
      }
    });
    setCurrent(nearest);
  }

  return (
    <div
      role="group"
      aria-roledescription="carrusel"
      aria-label="Testimonios de participantes"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <ul
        ref={trackRef}
        onScroll={handleScroll}
        className={cn(
          // items-start: cada testimonio mide lo que ocupa su texto. Si se
          // estiraran todas a la altura de la más larga, una cita de dos
          // líneas quedaría con medio metro de vacío abajo.
          "flex items-start snap-x snap-mandatory gap-4 overflow-x-auto pb-2 sm:gap-6",
          // La barra de desplazamiento se esconde: el carrusel ya tiene puntos.
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        )}
      >
        {testimonials.map((testimonial) => (
          <li
            key={testimonial.id}
            className="w-full shrink-0 snap-start sm:w-[calc((100%-1.5rem)/2)] lg:w-[calc((100%-3rem)/3)]"
          >
            <VoiceCard
              testimonial={testimonial}
              showEditionName={showEditionName}
            />
          </li>
        ))}
      </ul>

      {testimonials.length > 1 ? (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {testimonials.map((testimonial, index) => (
            <button
              key={testimonial.id}
              type="button"
              aria-label={`Ir al testimonio ${index + 1} de ${testimonials.length}`}
              aria-current={index === current ? "true" : undefined}
              onClick={() => goTo(index, !reducedMotion)}
              className={cn(
                "h-2.5 rounded-full transition-[width,background-color] duration-[var(--ck-duration-base)]",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ck-yellow",
                index === current
                  ? "w-8 bg-ck-yellow"
                  : "w-2.5 bg-ck-border hover:bg-ck-border-strong",
              )}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
