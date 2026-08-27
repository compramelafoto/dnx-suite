/**
 * Landing pública de un concurso en fase "PRÓXIMAMENTE".
 *
 * Usa el MISMO sistema visual que la landing de concursos publicados
 * (`ContestShell`, hero editorial, primitivas `fr-*` y el tema resuelto por
 * `resolveContestVisualTheme`). Sólo cambia el contenido: acá no hay precios,
 * ni carga de obras, ni CTA de inscripción — el llamado a la acción es
 * registrar el interés.
 */
import { BellRing, CalendarDays, Camera, Ticket, Trophy, UserRound } from "lucide-react";

import {
  Cluster,
  ContentContainer,
  ContestIconLabel,
  ContestMedia,
  ContestPublicHeader,
  ContestShell,
  ContestStatusPill,
  PageSection,
  ReadingContainer,
  SectionHeading,
  Stack,
  Surface,
} from "../contest-public";
import {
  contestThemeToCssVars,
  hasUsableImageUrl,
  resolveContestVisualTheme,
  resolveHeroAsset,
} from "../../lib/fotorank/contest-visual";
import type { UpcomingContestCard as CardData } from "../../lib/fotorank/upcoming/service";
import { NotifyMeButton } from "./NotifyMeButton";

export type UpcomingContestLandingProps = {
  card: CardData;
  interest: { status: "ACTIVE" | "CANCELLED" | "CONVERTED"; benefitEligible: boolean } | null;
  brief?: { title: string; text: string } | null;
  /** Fecha prevista de apertura, ya formateada. */
  opensAtLabel?: string | null;
  /** Cierre de la captación de interesados con beneficio, ya formateado. */
  benefitCutoffLabel?: string | null;
  /** Premio resumido, si ya puede anunciarse. */
  prizeLabel?: string | null;
  /**
   * Imágenes cargadas desde el administrador. Ganan sobre el manifiesto en
   * código: ver `lib/fotorank/contest-media`.
   */
  managed?: {
    banner?: { url: string; alt: string; focalPointX?: number; focalPointY?: number } | null;
    card?: { url: string; alt: string; focalPointX?: number; focalPointY?: number } | null;
    social?: { url: string; alt: string; focalPointX?: number; focalPointY?: number } | null;
  } | null;
  previewMode?: boolean;
};

export function UpcomingContestLanding({
  card,
  interest,
  brief,
  opensAtLabel,
  benefitCutoffLabel,
  prizeLabel,
  managed = null,
  previewMode = false,
}: UpcomingContestLandingProps) {
  const theme = resolveContestVisualTheme(card.slug, undefined, {
    coverImageUrl: card.coverImageUrl,
    organizerLogoUrl: card.organizerLogoUrl,
    contestTitle: card.title,
    organizerName: card.organizerName,
    managed,
  });
  const cssVars = contestThemeToCssVars(theme);
  const presentation = theme.presentation;

  const heroDesktop = resolveHeroAsset(presentation, "desktop");
  const heroMobile = resolveHeroAsset(presentation, "mobile");
  const hasHeroImage = Boolean(heroDesktop || heroMobile);
  const contestLogo = presentation.identity.contestLogo;

  return (
    <ContestShell cssVars={cssVars}>
      <ContestPublicHeader
        contestTitle={card.title}
        contestSlug={card.slug}
        inscriptionHref={`/concursos/${card.slug}`}
        ctaEnabled={false}
        ctaLabel="Próximamente"
      />

      {/* Hero editorial — mismo tratamiento que un concurso publicado. */}
      <header
        className={[
          "fr-contest-hero fr-contest-hero--editorial",
          `fr-contest-hero--align-${presentation.hero.textAlignment}`,
          `fr-contest-hero--pos-${presentation.hero.contentPosition}`,
          hasHeroImage ? "fr-contest-hero--has-media" : "fr-contest-hero--fallback",
        ].join(" ")}
      >
        {hasHeroImage ? (
          <>
            {heroDesktop ? (
              <ContestMedia
                asset={heroDesktop}
                className="fr-contest-hero__media fr-contest-hero__media--desktop"
                priority
                sizes="100vw"
              />
            ) : null}
            {heroMobile || heroDesktop ? (
              <ContestMedia
                asset={heroMobile ?? heroDesktop}
                className="fr-contest-hero__media fr-contest-hero__media--mobile"
                priority
                sizes="100vw"
              />
            ) : null}
          </>
        ) : (
          <div className="fr-contest-hero__fallback" aria-hidden />
        )}
        <div className="fr-contest-hero__overlay" aria-hidden />

        <ContentContainer className="fr-contest-hero__content">
          <Stack gap="md" className="fr-contest-hero__copy">
            <Cluster gap="sm">
              <ContestStatusPill icon={BellRing}>Próximamente</ContestStatusPill>
              {card.contestType ? (
                <ContestStatusPill tone="muted">{card.contestType}</ContestStatusPill>
              ) : null}
              {previewMode ? (
                <ContestStatusPill tone="warning">Vista previa</ContestStatusPill>
              ) : null}
            </Cluster>

            {contestLogo && hasUsableImageUrl(contestLogo.url) ? (
              <div className="fr-contest-hero__contest-logo">
                <ContestMedia asset={contestLogo} className="fr-contest-hero__contest-logo-img" />
              </div>
            ) : null}

            <p className="fr-type-eyebrow fr-contest-hero__org-label">Organiza</p>
            <p className="fr-contest-hero__org-name">{card.organizerName}</p>

            <h1 className="fr-type-display fr-contest-hero__title">{card.title}</h1>

            {card.tagline ? (
              <p className="fr-type-body-large fr-contest-hero__lead">{card.tagline}</p>
            ) : null}

            {opensAtLabel ? (
              <p className="fr-type-caption fr-contest-hero__date">{opensAtLabel}</p>
            ) : null}

            <Cluster gap="sm" className="fr-contest-hero__actions">
              <NotifyMeButton
                contestId={card.id}
                slug={card.slug}
                contestTitle={card.title}
                initialInterest={interest}
                disabledReason={
                  previewMode
                    ? "Vista previa administrativa: el registro real está deshabilitado."
                    : null
                }
              />
            </Cluster>
          </Stack>
        </ContentContainer>
      </header>

      {/* Franja información crítica */}
      <div className="fr-contest-info-strip" aria-label="Información principal">
        <ContentContainer>
          <ul className="fr-contest-info-strip__list">
            <li>
              <span className="fr-contest-info-strip__label">
                <ContestIconLabel icon={Ticket}>Estado</ContestIconLabel>
              </span>
              <span className="fr-contest-info-strip__value">Próximamente</span>
            </li>
            {opensAtLabel ? (
              <li>
                <span className="fr-contest-info-strip__label">
                  <ContestIconLabel icon={CalendarDays}>Apertura</ContestIconLabel>
                </span>
                <span className="fr-contest-info-strip__value">{opensAtLabel}</span>
              </li>
            ) : null}
            <li>
              <span className="fr-contest-info-strip__label">
                <ContestIconLabel icon={UserRound}>Participación</ContestIconLabel>
              </span>
              <span className="fr-contest-info-strip__value">Profesionales y aficionados</span>
            </li>
            {prizeLabel ? (
              <li>
                <span className="fr-contest-info-strip__label">
                  <ContestIconLabel icon={Trophy}>Gran premio</ContestIconLabel>
                </span>
                <span className="fr-contest-info-strip__value">{prizeLabel}</span>
              </li>
            ) : null}
            <li>
              <span className="fr-contest-info-strip__label">
                <ContestIconLabel icon={Camera}>Carga de fotografías</ContestIconLabel>
              </span>
              <span className="fr-contest-info-strip__value">Aún no habilitada</span>
            </li>
          </ul>
        </ContentContainer>
      </div>

      <nav className="fr-contest-anchor-nav" aria-label="Secciones del concurso">
        <ContentContainer>
          <ul className="fr-contest-cluster fr-contest-cluster--gap-md fr-contest-cluster--align-center">
            {card.summary ? (
              <li>
                <a href="#resumen">Presentación</a>
              </li>
            ) : null}
            {brief ? (
              <li>
                <a href="#consigna">Consigna</a>
              </li>
            ) : null}
            <li>
              <a href="#aviso">Cómo participar</a>
            </li>
          </ul>
        </ContentContainer>
      </nav>

      {card.summary ? (
        <PageSection id="resumen">
          {/* ReadingContainer siempre dentro de ContentContainer: el ancho y el
              padding lateral los aporta el contenedor externo. */}
          <ContentContainer>
            <ReadingContainer>
              <p className="fr-type-body-large">{card.summary}</p>
            </ReadingContainer>
          </ContentContainer>
        </PageSection>
      ) : null}

      {brief ? (
        <PageSection id="consigna">
          <ContentContainer>
            <Stack gap="md">
              <SectionHeading eyebrow="Consigna" title={brief.title} icon={CalendarDays} />
              <ReadingContainer>
                <Stack gap="sm">
                  {brief.text.split("\n\n").map((paragraph, i) => (
                    <p key={i} className="fr-type-body">
                      {paragraph}
                    </p>
                  ))}
                </Stack>
              </ReadingContainer>
            </Stack>
          </ContentContainer>
        </PageSection>
      ) : null}

      <PageSection id="aviso">
        <ContentContainer>
          <Surface padding="lg">
            <Stack gap="sm">
              <SectionHeading
                level={3}
                title="Todavía no están abiertas las inscripciones"
                description={
                  benefitCutoffLabel
                    ? `Registrarte para recibir el aviso no implica ningún pago ni compromiso de participación. Si te anotás antes del ${benefitCutoffLabel}, accedés a un precio promocional exclusivo.`
                    : "Registrarte para recibir el aviso no implica ningún pago ni compromiso de participación."
                }
              />
            </Stack>
          </Surface>
        </ContentContainer>
      </PageSection>
    </ContestShell>
  );
}
