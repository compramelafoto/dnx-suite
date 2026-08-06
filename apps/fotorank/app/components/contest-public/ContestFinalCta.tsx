import { CalendarDays, Camera, CircleDollarSign, FileText } from "lucide-react";
import Link from "next/link";
import { ContestIconLabel } from "./ContestIconLabel";
import { ContestStatusPill } from "./ContestStatusPill";
import { ContentContainer, ContentToActions, PageSection } from "./primitives";

type Props = {
  title: string;
  statusLabel: string;
  statusTone?: "accent" | "muted" | "success" | "warning";
  isFree: boolean;
  ctaEnabled: boolean;
  ctaLabel: string;
  inscriptionHref: string;
  uploadClosed: boolean;
  registrationCloseLabel: string | null;
};

/**
 * Cierre de landing: título, meta con íconos, CTAs con respiración clara.
 */
export function ContestFinalCta({
  title,
  statusLabel,
  statusTone = "accent",
  isFree,
  ctaEnabled,
  ctaLabel,
  inscriptionHref,
  uploadClosed,
  registrationCloseLabel,
}: Props) {
  return (
    <PageSection className="fr-contest-section--flush" tone="emphasis" id="sumate">
      <ContentContainer>
        <div className="fr-contest-final-cta">
          <div className="fr-contest-final-cta__inner">
            <ContestStatusPill tone={statusTone}>{statusLabel}</ContestStatusPill>

            <h2 className="fr-contest-final-cta__title">{title}</h2>

            {isFree && ctaEnabled ? (
              <p className="fr-contest-final-cta__lead">Inscripción gratuita.</p>
            ) : null}

            <ul className="fr-contest-final-cta__meta">
              {registrationCloseLabel && ctaEnabled ? (
                <li>
                  <ContestIconLabel icon={CalendarDays}>
                    Inscripciones hasta el <strong>{registrationCloseLabel}</strong>
                  </ContestIconLabel>
                </li>
              ) : null}
              {isFree && ctaEnabled ? (
                <li>
                  <ContestIconLabel icon={CircleDollarSign}>Sin costo de inscripción</ContestIconLabel>
                </li>
              ) : null}
              {uploadClosed ? (
                <li>
                  <ContestIconLabel icon={Camera}>
                    La carga de fotografías todavía no está habilitada
                  </ContestIconLabel>
                </li>
              ) : (
                <li>
                  <ContestIconLabel icon={Camera}>Carga de fotografías habilitada</ContestIconLabel>
                </li>
              )}
            </ul>

            <ContentToActions className="fr-contest-final-cta__actions">
              {ctaEnabled ? (
                <Link href={inscriptionHref} className="fr-btn fr-btn-primary fr-contest-final-cta__primary">
                  {ctaLabel}
                </Link>
              ) : (
                <span className="fr-btn fr-btn-secondary fr-contest-final-cta__primary" aria-disabled="true">
                  {ctaLabel}
                </span>
              )}
              <a href="#bases" className="fr-btn fr-btn-ghost fr-contest-final-cta__secondary">
                <FileText width={16} height={16} strokeWidth={1.75} aria-hidden />
                Leer bases
              </a>
            </ContentToActions>
          </div>
        </div>
      </ContentContainer>
    </PageSection>
  );
}
