/**
 * Tarjeta pública de un concurso próximo.
 *
 * Componente reutilizable: no sabe nada de un concurso en particular.
 * Usa las primitivas del sistema visual de concursos (`Surface`, `Stack`,
 * `ContestStatusPill`, tipografías `fr-*`) para verse igual que el resto de la
 * plataforma.
 */
import { BellRing } from "lucide-react";

import { Cluster, ContestStatusPill, Stack, Surface } from "../contest-public";
import { hasUsableImageUrl } from "../../lib/fotorank/contest-visual";
import type { UpcomingContestCard as CardData } from "../../lib/fotorank/upcoming/service";
import { NotifyMeButton } from "./NotifyMeButton";

export type UpcomingContestCardProps = {
  card: CardData;
  /** Estado del interés del usuario actual. null = sin registro o sin sesión. */
  interest: { status: "ACTIVE" | "CANCELLED" | "CONVERTED"; benefitEligible: boolean } | null;
  /** Marca visual de que la tarjeta se está previsualizando desde administración. */
  previewMode?: boolean;
  /** Ancho de referencia para el preview responsive. */
  variant?: "desktop" | "mobile";
};

export function UpcomingContestCard({
  card,
  interest,
  previewMode = false,
  variant = "desktop",
}: UpcomingContestCardProps) {
  const isMobile = variant === "mobile";
  const hasImage = hasUsableImageUrl(card.coverImageUrl);

  return (
    <Surface
      as="article"
      padding="md"
      elevated
      interactive
      className={[
        "fr-contest-upcoming-card",
        isMobile ? "fr-contest-upcoming-card--mobile" : null,
      ]
        .filter(Boolean)
        .join(" ")}
      data-testid="upcoming-contest-card"
      data-variant={variant}
    >
      <Stack gap="md">
        {/* Imagen o placeholder administrativo: nunca una imagen ficticia como definitiva. */}
        <div className="fr-contest-upcoming-card__media">
          {hasImage ? (
            // eslint-disable-next-line @next/next/no-img-element -- URL arbitraria del organizador
            <img src={card.coverImageUrl!.trim()} alt="" aria-hidden />
          ) : (
            <div className="fr-contest-upcoming-card__media-empty">
              <span className="fr-type-eyebrow">Sin imagen cargada</span>
              <span className="fr-type-caption">Placeholder administrativo — no publicar así</span>
            </div>
          )}
        </div>

        <Cluster gap="sm">
          <ContestStatusPill icon={BellRing}>Próximamente</ContestStatusPill>
          {card.contestType ? (
            <ContestStatusPill tone="muted">{card.contestType}</ContestStatusPill>
          ) : null}
          {previewMode ? <ContestStatusPill tone="warning">Vista previa</ContestStatusPill> : null}
        </Cluster>

        <Stack gap="sm">
          <h3 className="fr-type-h fr-contest-upcoming-card__title">{card.title}</h3>
          {card.tagline ? (
            <p className="fr-type-body-large fr-contest-upcoming-card__tagline">{card.tagline}</p>
          ) : null}
          {card.summary ? <p className="fr-type-body">{card.summary}</p> : null}
        </Stack>

        <NotifyMeButton
          contestId={card.id}
          slug={card.slug}
          contestTitle={card.title}
          initialInterest={interest}
          disabledReason={
            previewMode ? "Vista previa administrativa: el registro real está deshabilitado." : null
          }
        />
      </Stack>
    </Surface>
  );
}
