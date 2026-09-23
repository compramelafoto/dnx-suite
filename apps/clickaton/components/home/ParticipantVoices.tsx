import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { VoicesCarousel } from "@/components/home/VoicesCarousel";
import { shuffleForDisplay } from "@/lib/testimonials/public/carousel";
import type { PublishedTestimonial } from "@/lib/testimonials/public/list-published";
import { shouldRenderVoices } from "@/lib/testimonials/public/voices-presentation";

type ParticipantVoicesProps = {
  testimonials: readonly PublishedTestimonial[];
  /** En la ficha de una edición no hace falta repetir el nombre de la edición. */
  showEditionName?: boolean;
  title?: string;
  eyebrow?: string;
};

/**
 * "Lo que dicen los participantes".
 *
 * Con menos de tres testimonios publicados no se dibuja nada: dos citas
 * sueltas se leen peor que no tener la sección.
 *
 * El orden se baraja en el servidor, una vez por visita. Barajarlo en el
 * navegador haría que el primer dibujado mostrara un orden y el siguiente
 * otro, con un salto a la vista.
 */
export function ParticipantVoices({
  testimonials,
  showEditionName = true,
  title = "Lo que dicen los participantes",
  eyebrow = "En sus palabras",
}: ParticipantVoicesProps) {
  if (!shouldRenderVoices(testimonials.length)) return null;

  const ordered = shuffleForDisplay(testimonials, Math.random);

  return (
    <Section id="voces" tone="base" aria-labelledby="voces-title">
      <Container>
        <SectionHeader
          eyebrow={eyebrow}
          title={title}
          description="Testimonios de quienes estuvieron ahí, publicados con su autorización."
          titleId="voces-title"
        />
        <div className="mt-[var(--ck-stack-subtitle-to-content)]">
          <VoicesCarousel
            testimonials={ordered}
            showEditionName={showEditionName}
          />
        </div>
      </Container>
    </Section>
  );
}
