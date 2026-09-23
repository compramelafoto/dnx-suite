import Image from "next/image";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import type { PublishedTestimonial } from "@/lib/testimonials/public/list-published";
import {
  authorRoleLabel,
  shouldRenderVoices,
  toInitials,
} from "@/lib/testimonials/public/voices-presentation";

type ParticipantVoicesProps = {
  testimonials: readonly PublishedTestimonial[];
  /** En la ficha de una edición no hace falta repetir el nombre de la edición. */
  showEditionName?: boolean;
  title?: string;
  eyebrow?: string;
};

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
      <Card as="figure" className="flex h-full flex-col justify-between">
        {body}
      </Card>
    );
  }

  return (
    <Card
      as="figure"
      variant="interactive"
      className="flex h-full flex-col justify-between"
    >
      <a
        href={testimonial.linkUrl}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className={cn(
          "flex h-full flex-col justify-between",
          "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ck-yellow",
        )}
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
 * "Lo que dicen los participantes".
 *
 * Con menos de tres testimonios publicados no se dibuja nada: dos citas
 * sueltas se leen peor que no tener la sección.
 */
export function ParticipantVoices({
  testimonials,
  showEditionName = true,
  title = "Lo que dicen los participantes",
  eyebrow = "En sus palabras",
}: ParticipantVoicesProps) {
  if (!shouldRenderVoices(testimonials.length)) return null;

  return (
    <Section id="voces" tone="base" aria-labelledby="voces-title">
      <Container>
        <SectionHeader
          eyebrow={eyebrow}
          title={title}
          description="Testimonios de quienes estuvieron ahí, publicados con su autorización."
          titleId="voces-title"
        />
        {/* Dos columnas como máximo: el testimonio sale completo y en tres
            columnas se lee apretado. */}
        <ul className="mt-[var(--ck-stack-subtitle-to-content)] grid gap-4 sm:gap-6 md:grid-cols-2">
          {testimonials.map((testimonial) => (
            <li key={testimonial.id} className="h-full">
              <VoiceCard
                testimonial={testimonial}
                showEditionName={showEditionName}
              />
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}
