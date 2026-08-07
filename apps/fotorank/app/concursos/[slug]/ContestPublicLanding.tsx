import {
  Building2,
  CalendarDays,
  Camera,
  ClipboardList,
  Layers,
  ListOrdered,
  Ticket,
  Trophy,
  UserRound,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import {
  Cluster,
  ContentContainer,
  ContentToActions,
  ContestCategoriesSection,
  ContestFinalCta,
  ContestGallery,
  ContestIconLabel,
  ContestMedia,
  ContestMediaFigure,
  ContestPartnersSection,
  ContestPrizesSection,
  ContestPublicHeader,
  ContestShell,
  ContestStatusPill,
  PageSection,
  ReadingContainer,
  RulesDocument,
  SectionHeading,
  Stack,
  Surface,
} from "../../components/contest-public";
import { resolvePublicContestPrizes } from "../../lib/fotorank/contest-public-presentation";
import {
  contestThemeToCssVars,
  hasUsableImageUrl,
  isSantaFeEnFocoSlug,
  resolveContestVisualTheme,
  resolveHeroAsset,
  usableGallery,
} from "../../lib/fotorank/contest-visual";
import type { PublicContestLandingData } from "../../lib/fotorank/publicContestLanding";
import type { PublicPartnerGroup } from "@repo/partners";

function fmtDate(d: Date | null): string | null {
  if (!d) return null;
  try {
    return d.toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return null;
  }
}

function igHref(raw: string): string {
  const t = raw.trim();
  if (t.startsWith("http")) return t;
  return `https://instagram.com/${t.replace(/^@/, "")}`;
}

function orgInitials(name: string): string {
  const skip = new Set(["de", "del", "la", "las", "los", "y", "e", "the", "of"]);
  const letters = name
    .split(/\s+/)
    .filter((w) => w && !skip.has(w.toLowerCase()))
    .map((w) => w[0] ?? "")
    .join("")
    .slice(0, 3)
    .toUpperCase();
  return letters || name.slice(0, 2).toUpperCase();
}

type LandingPhase = "coming-soon" | "open" | "last-days" | "closed" | "in-evaluation" | "finalized";

function getLandingPhase(data: PublicContestLandingData): LandingPhase {
  const now = Date.now();
  const openAt =
    data.contest.registrationOpensAt?.getTime() ?? data.contest.startAt?.getTime() ?? null;
  const closeAt =
    data.contest.registrationClosesAt?.getTime() ??
    data.contest.submissionDeadline?.getTime() ??
    null;
  const judgingStart = data.contest.judgingStartAt?.getTime() ?? null;
  const results = data.contest.resultsAt?.getTime() ?? null;

  if (data.contest.status === "ARCHIVED") return "finalized";
  if (data.contest.status === "CLOSED") return "closed";
  if (results && now >= results) return "finalized";
  if (judgingStart && now >= judgingStart && (!results || now < results)) return "in-evaluation";
  if (closeAt && now > closeAt) return "closed";
  if (openAt && now < openAt) return "coming-soon";
  if (closeAt) {
    const daysLeft = Math.ceil((closeAt - now) / (1000 * 60 * 60 * 24));
    if (daysLeft <= 7) return "last-days";
  }
  return "open";
}

const PHASE_LABEL: Record<LandingPhase, string> = {
  "coming-soon": "Próximamente",
  open: "Inscripciones abiertas",
  "last-days": "Últimos días",
  closed: "Cerrado",
  "in-evaluation": "En evaluación",
  finalized: "Finalizado",
};

function phaseCta(phase: LandingPhase): { primary: string; enabled: boolean } {
  if (phase === "closed" || phase === "in-evaluation" || phase === "finalized") {
    return { primary: "Inscripciones cerradas", enabled: false };
  }
  if (phase === "coming-soon") return { primary: "Próximamente", enabled: false };
  return { primary: "Participar ahora", enabled: true };
}

function PrimaryCta({
  href,
  enabled,
  label,
  id,
}: {
  href: string;
  enabled: boolean;
  label: string;
  id?: string;
}) {
  if (enabled) {
    return (
      <Link href={href} id={id} className="fr-btn fr-btn-primary">
        {label}
      </Link>
    );
  }
  return (
    <span className="fr-btn fr-btn-secondary" aria-disabled="true">
      {label}
    </span>
  );
}

export function ContestPublicLanding({
  data,
  partnerGroups = [],
}: {
  data: PublicContestLandingData;
  partnerGroups?: PublicPartnerGroup[];
}) {
  const { contest, organization: org, judges } = data;
  const theme = resolveContestVisualTheme(
    contest.slug,
    undefined,
    {
      coverImageUrl: contest.coverImageUrl,
      organizerLogoUrl: org.logoUrl,
      contestTitle: contest.title,
      organizerName: org.name,
    },
  );
  const cssVars = contestThemeToCssVars(theme);
  const presentation = theme.presentation;

  const publicPrizes = resolvePublicContestPrizes({
    contestSlug: contest.slug,
    rulesData: contest.rulesData,
    categories: contest.categories.map((c) => ({ id: c.id, name: c.name })),
  });
  const hasPublicPrizesSection = publicPrizes.length > 0 || Boolean(contest.prizesSummary?.trim());
  const phase = getLandingPhase(data);
  const cta = phaseCta(phase);

  const heroDesktop = resolveHeroAsset(presentation, "desktop");
  const heroMobile = resolveHeroAsset(presentation, "mobile");
  const hasHeroImage = Boolean(heroDesktop || heroMobile);
  const orgLogo = presentation.identity.organizerLogo;
  const contestLogo = presentation.identity.contestLogo;
  const overviewImage = presentation.editorial.overview;
  const galleryItems = usableGallery(presentation.gallery);

  const inscripcionHref = `/concursos/${contest.slug}/inscripcion`;
  const categoriasCount = contest.categories.length;
  // SFEF: etiquetas canónicas del cronograma público (cierre inclusivo 30/09).
  // El instante técnico exclusivo permanece 01/10 00:00 America/Argentina/Cordoba.
  const registrationOpenLabel = isSantaFeEnFocoSlug(contest.slug)
    ? "1 de agosto de 2026"
    : fmtDate(contest.registrationOpensAt ?? contest.startAt);
  const registrationCloseLabel = isSantaFeEnFocoSlug(contest.slug)
    ? "30 de septiembre de 2026"
    : fmtDate(contest.registrationClosesAt ?? contest.submissionDeadline);
  const uploadOpen =
    contest.submissionOpensAt != null && contest.submissionOpensAt.getTime() <= Date.now();
  const uploadClosedForUi =
    !uploadOpen ||
    (contest.submissionDeadline != null && contest.submissionDeadline.getTime() < Date.now());
  const isFree = contest.registrationPricingMode === "FREE";
  const heroDateLabel = registrationCloseLabel
    ? `Inscripciones hasta el ${registrationCloseLabel}`
    : registrationOpenLabel
      ? `Apertura ${registrationOpenLabel}`
      : null;

  return (
    <ContestShell cssVars={cssVars}>
      <ContestPublicHeader
        contestTitle={contest.title}
        contestSlug={contest.slug}
        inscriptionHref={inscripcionHref}
        ctaEnabled={cta.enabled}
        ctaLabel={cta.primary}
      />

      {/* Hero editorial */}
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
              <ContestStatusPill icon={Ticket}>{PHASE_LABEL[phase]}</ContestStatusPill>
              {isFree ? (
                <ContestStatusPill tone="muted">Inscripción gratuita</ContestStatusPill>
              ) : null}
              {contest.visibility !== "PUBLIC" ? (
                <ContestStatusPill tone="muted">
                  {contest.visibility === "UNLISTED" ? "Solo por invitación / link" : "Acceso privado"}
                </ContestStatusPill>
              ) : null}
            </Cluster>

            {contestLogo && hasUsableImageUrl(contestLogo.url) ? (
              <div className="fr-contest-hero__contest-logo">
                <ContestMedia asset={contestLogo} className="fr-contest-hero__contest-logo-img" />
              </div>
            ) : null}

            <p className="fr-type-eyebrow fr-contest-hero__org-label">Organiza</p>
            <p className="fr-contest-hero__org-name">{org.name}</p>

            <h1 className="fr-type-display fr-contest-hero__title">{contest.title}</h1>

            {contest.shortDescription ? (
              <p className="fr-type-body-large fr-contest-hero__lead">{contest.shortDescription}</p>
            ) : null}

            {heroDateLabel ? <p className="fr-type-caption fr-contest-hero__date">{heroDateLabel}</p> : null}

            <Cluster gap="sm" className="fr-contest-hero__actions">
              <PrimaryCta
                href={inscripcionHref}
                enabled={cta.enabled}
                label={cta.primary}
                id="inscribirse"
              />
              <a href="#bases" className="fr-btn fr-btn-secondary">
                Ver bases
              </a>
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
              <span className="fr-contest-info-strip__value">{PHASE_LABEL[phase]}</span>
            </li>
            {registrationCloseLabel ? (
              <li>
                <span className="fr-contest-info-strip__label">
                  <ContestIconLabel icon={CalendarDays}>Cierre de inscripción</ContestIconLabel>
                </span>
                <span className="fr-contest-info-strip__value">{registrationCloseLabel}</span>
              </li>
            ) : null}
            <li>
              <span className="fr-contest-info-strip__label">
                <ContestIconLabel icon={UserRound}>Participación</ContestIconLabel>
              </span>
              <span className="fr-contest-info-strip__value">
                {isFree ? "Gratuita" : "Consultá bases"}
              </span>
            </li>
            <li>
              <span className="fr-contest-info-strip__label">
                <ContestIconLabel icon={Layers}>Modalidad</ContestIconLabel>
              </span>
              <span className="fr-contest-info-strip__value">
                {categoriasCount
                  ? `${categoriasCount} categoría${categoriasCount === 1 ? "" : "s"}`
                  : "—"}
              </span>
            </li>
            <li>
              <span className="fr-contest-info-strip__label">
                <ContestIconLabel icon={Camera}>Carga de fotografías</ContestIconLabel>
              </span>
              <span className="fr-contest-info-strip__value">
                {uploadClosedForUi ? "Aún no habilitada" : "Habilitada"}
              </span>
            </li>
          </ul>
        </ContentContainer>
      </div>

      <nav className="fr-contest-anchor-nav" aria-label="Secciones del concurso">
        <ContentContainer>
          <ul className="fr-contest-cluster fr-contest-cluster--gap-md fr-contest-cluster--align-center">
            {(contest.fullDescription || overviewImage) && (
              <li>
                <a href="#presentacion">Presentación</a>
              </li>
            )}
            {contest.categories.length > 0 && (
              <li>
                <a href="#categorias">Categorías</a>
              </li>
            )}
            <li>
              <a href="#cronograma">Cronograma</a>
            </li>
            <li>
              <a href="#como-participar">Cómo participar</a>
            </li>
            <li>
              <a href="#organizador">Organización</a>
            </li>
            {hasPublicPrizesSection && (
              <li>
                <a href="#premios">Premios</a>
              </li>
            )}
            {galleryItems.length > 0 && (
              <li>
                <a href="#galeria">Galería</a>
              </li>
            )}
            {judges.length > 0 && (
              <li>
                <a href="#jurado">Jurado</a>
              </li>
            )}
            <li>
              <a href="#bases">Bases</a>
            </li>
            <li>
              <a href="#faq">FAQ</a>
            </li>
          </ul>
        </ContentContainer>
      </nav>

      {/* Presentación editorial asimétrica */}
      {contest.fullDescription || overviewImage ? (
        <PageSection id="presentacion">
          <ContentContainer>
            <div
              className={[
                "fr-contest-editorial",
                overviewImage && hasUsableImageUrl(overviewImage.url)
                  ? "fr-contest-editorial--split"
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <div className="fr-contest-editorial__text">
                <SectionHeading title="El concurso" />
                {contest.fullDescription ? (
                  <ReadingContainer>
                    <div className="fr-type-body whitespace-pre-wrap">{contest.fullDescription}</div>
                  </ReadingContainer>
                ) : contest.shortDescription ? (
                  <p className="fr-type-body-large">{contest.shortDescription}</p>
                ) : null}
              </div>
              {overviewImage && hasUsableImageUrl(overviewImage.url) ? (
                <div className="fr-contest-editorial__media">
                  <ContestMediaFigure asset={overviewImage} sizes="(max-width: 768px) 100vw, 48vw" />
                </div>
              ) : null}
            </div>
          </ContentContainer>
        </PageSection>
      ) : null}

      <ContestCategoriesSection
        categories={contest.categories}
        inscriptionHref={inscripcionHref}
        inscriptionEnabled={cta.enabled}
      />

      <ContestPrizesSection
        prizes={publicPrizes}
        summaryFallback={publicPrizes.length === 0 ? contest.prizesSummary : null}
      />

      <PageSection id="cronograma">
        <ContentContainer>
          <SectionHeading icon={CalendarDays} title="Cronograma" />
          <ol className="fr-contest-timeline">
            {(
              [
                ["Apertura de inscripción", registrationOpenLabel, Ticket],
                ["Cierre de inscripción", registrationCloseLabel, CalendarDays],
                ["Inicio de evaluación", fmtDate(contest.judgingStartAt), ClipboardList],
                ["Fin de evaluación", fmtDate(contest.judgingEndAt), ListOrdered],
                ["Resultados", fmtDate(contest.resultsAt), Trophy],
              ] as const
            )
              .filter((i) => i[1])
              .map(([label, value, Icon]) => (
                <li key={label} className="fr-contest-timeline__item">
                  <span className="fr-contest-timeline__marker" aria-hidden>
                    <Icon width={16} height={16} strokeWidth={1.75} />
                  </span>
                  <span className="fr-contest-timeline__label">{label}</span>
                  <span className="fr-contest-timeline__value">{value}</span>
                </li>
              ))}
          </ol>
        </ContentContainer>
      </PageSection>

      <PageSection id="como-participar">
        <ContentContainer>
          <SectionHeading icon={ListOrdered} title="Cómo participar" />
          <ReadingContainer>
            <ol className="fr-contest-steps">
              <li>
                <span className="fr-contest-steps__icon" aria-hidden>
                  <Ticket width={16} height={16} strokeWidth={1.75} />
                </span>
                <strong>Inscripción.</strong> Creá tu cuenta, elegí categoría y aceptá las bases
                publicadas antes del cierre.
              </li>
              <li>
                <span className="fr-contest-steps__icon" aria-hidden>
                  <UserRound width={16} height={16} strokeWidth={1.75} />
                </span>
                <strong>Confirmación.</strong> Recibís tu número de inscripción
                {isFree ? " sin cobro" : ""}.
              </li>
              <li>
                <span className="fr-contest-steps__icon" aria-hidden>
                  <Camera width={16} height={16} strokeWidth={1.75} />
                </span>
                <strong>Carga de fotografías.</strong>{" "}
                {uploadClosedForUi
                  ? "Todavía no está habilitada. Cuando la organización abra la ventana, podrás subir tu obra según las bases."
                  : "Subí tu fotografía respetando formato y tamaño indicados en las bases."}
              </li>
              <li>
                <span className="fr-contest-steps__icon" aria-hidden>
                  <ClipboardList width={16} height={16} strokeWidth={1.75} />
                </span>
                <strong>Evaluación.</strong> El jurado evalúa las obras admitidas en el período
                previsto.
              </li>
              <li>
                <span className="fr-contest-steps__icon" aria-hidden>
                  <Trophy width={16} height={16} strokeWidth={1.75} />
                </span>
                <strong>Resultados.</strong>{" "}
                {fmtDate(contest.resultsAt)
                  ? `Publicación prevista: ${fmtDate(contest.resultsAt)}.`
                  : "Se comunicarán según el cronograma del concurso."}
              </li>
            </ol>
          </ReadingContainer>
          <ContentToActions>
            <PrimaryCta href={inscripcionHref} enabled={cta.enabled} label={cta.primary} />
          </ContentToActions>
        </ContentContainer>
      </PageSection>

      <PageSection id="organizador" tone="muted">
        <ContentContainer>
          <SectionHeading icon={Building2} title="Organización" />
          <div className="fr-contest-org-editorial">
            <div className="fr-contest-org-editorial__identity">
              {orgLogo && hasUsableImageUrl(orgLogo.url) ? (
                <div className="fr-contest-org-editorial__logo">
                  <ContestMedia asset={orgLogo} />
                </div>
              ) : (
                <div className="fr-contest-org-editorial__mark" aria-hidden>
                  <span>{orgInitials(org.name)}</span>
                </div>
              )}
              <div>
                <h3 className="fr-type-h2" style={{ color: "var(--cv-foreground)" }}>
                  {org.name}
                </h3>
                {org.shortDescription ? (
                  <p className="fr-type-body mt-3">{org.shortDescription}</p>
                ) : null}
              </div>
            </div>
            {presentation.identity.secondaryLogos.length > 0 ? (
              <ul className="fr-contest-org-editorial__secondary">
                {presentation.identity.secondaryLogos
                  .filter((l) => hasUsableImageUrl(l.url))
                  .map((logo) => (
                    <li key={logo.url}>
                      <ContestMedia asset={logo} className="fr-contest-org-editorial__secondary-img" />
                    </li>
                  ))}
              </ul>
            ) : null}
            <ul className="fr-contest-stack fr-contest-stack--xs fr-type-body-small mt-6">
              {[org.city, org.country].filter(Boolean).length > 0 ? (
                <li>{[org.city, org.country].filter(Boolean).join(", ")}</li>
              ) : null}
              {org.contactEmail ? (
                <li>
                  <a href={`mailto:${org.contactEmail}`} className="text-gold hover:text-gold-hover">
                    {org.contactEmail}
                  </a>
                </li>
              ) : null}
              {org.website ? (
                <li>
                  <a
                    href={org.website.startsWith("http") ? org.website : `https://${org.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gold hover:text-gold-hover"
                  >
                    Sitio web
                  </a>
                </li>
              ) : null}
              {org.instagram ? (
                <li>
                  <a
                    href={igHref(org.instagram)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gold hover:text-gold-hover"
                  >
                    Instagram
                  </a>
                </li>
              ) : null}
            </ul>
          </div>
        </ContentContainer>
      </PageSection>

      <ContestPartnersSection groups={partnerGroups} />

      <ContestGallery items={galleryItems} />

      {contest.sponsorsText && partnerGroups.length === 0 ? (
        <PageSection id="sponsors">
          <ContentContainer>
            <SectionHeading title="Sponsors y apoyos" />
            <ReadingContainer>
              <div className="fr-type-body whitespace-pre-wrap">{contest.sponsorsText}</div>
            </ReadingContainer>
          </ContentContainer>
        </PageSection>
      ) : null}

      {judges.length > 0 ? (
        <PageSection id="jurado">
          <ContentContainer>
            <SectionHeading title="Jurado" />
            <ul className="fr-contest-category-grid fr-contest-judge-grid">
              {judges.map((j) => (
                <li key={j.publicSlug}>
                  <Link
                    href={`/jurados/publico/${j.publicSlug}`}
                    className="block h-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cv-focus)]"
                  >
                    <Surface padding="md" interactive className="h-full text-center">
                      {j.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={j.avatarUrl}
                          alt=""
                          className="mx-auto h-20 w-20 rounded-full border border-[var(--cv-border)] object-cover"
                        />
                      ) : (
                        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-dashed border-[var(--cv-border)] fr-type-caption">
                          {j.firstName[0]}
                          {j.lastName[0]}
                        </div>
                      )}
                      <h3 className="fr-type-h3 mt-3" style={{ color: "var(--cv-foreground)" }}>
                        {j.firstName} {j.lastName}
                      </h3>
                      {j.shortBio ? (
                        <p className="fr-type-body-small mt-2 line-clamp-3">{j.shortBio}</p>
                      ) : null}
                    </Surface>
                  </Link>
                </li>
              ))}
            </ul>
          </ContentContainer>
        </PageSection>
      ) : null}

      <PageSection id="bases">
        <ContentContainer>
          <SectionHeading
            title="Bases y condiciones"
            description="Documento oficial. Se muestra con formato legible."
          />
          {contest.rulesText ? (
            <Surface padding="md" className="fr-contest-details">
              <details>
                <summary>Ver bases completas</summary>
                <div className="fr-rules-scroll">
                  <RulesDocument content={contest.rulesText} />
                </div>
              </details>
            </Surface>
          ) : (
            <p className="fr-type-body">
              Las bases estarán publicadas próximamente. Contactá al organizador.
            </p>
          )}
        </ContentContainer>
      </PageSection>

      <PageSection id="faq">
        <ContentContainer>
          <SectionHeading title="Preguntas frecuentes" />
          <ReadingContainer>
            <Stack gap="sm">
              <FaqItem
                q="¿Cómo me inscribo?"
                a="Creá una cuenta en FotoRank, iniciá sesión y usá el botón «Participar ahora»."
              />
              <FaqItem
                q="¿Hay costo de inscripción?"
                a={
                  isFree
                    ? "Este concurso es gratuito: no hay cobro ni redirección a pagos."
                    : "Si el concurso define arancel, figurará en las bases."
                }
              />
              <FaqItem
                q="¿Puedo subir fotografías ahora?"
                a={
                  uploadClosedForUi
                    ? "La carga todavía no está habilitada. Tu inscripción puede confirmarse; la carga se abre cuando la organización lo indique."
                    : "Sí, dentro del período de carga y según las bases."
                }
              />
              <FaqItem
                q="¿A quién contacto por dudas?"
                a={
                  org.contactEmail
                    ? `Escribí a ${org.contactEmail}.`
                    : "Usá los canales del organizador indicados en esta página."
                }
              />
            </Stack>
          </ReadingContainer>
        </ContentContainer>
      </PageSection>

      <ContestFinalCta
        title={cta.enabled ? "Sumate al concurso" : PHASE_LABEL[phase]}
        statusLabel={PHASE_LABEL[phase]}
        statusTone={
          phase === "open" || phase === "last-days"
            ? "accent"
            : phase === "coming-soon"
              ? "warning"
              : "muted"
        }
        isFree={isFree}
        ctaEnabled={cta.enabled}
        ctaLabel={cta.enabled ? cta.primary : "Ver estado"}
        inscriptionHref={inscripcionHref}
        uploadClosed={uploadClosedForUi}
        registrationCloseLabel={registrationCloseLabel}
      />

      <footer className="fr-contest-footer">
        <ContentContainer>
          <Stack gap="sm" className="items-center text-center">
            <Link href="/" className="inline-flex opacity-80 hover:opacity-100">
              <Image
                src="/fotorank-logo.png"
                alt="FotoRank"
                width={120}
                height={40}
                className="h-8 w-auto"
              />
            </Link>
            <p className="fr-type-caption">
              Organiza <strong style={{ color: "var(--cv-foreground)" }}>{org.name}</strong> ·
              Plataforma{" "}
              <Link href="/" className="text-gold">
                FotoRank
              </Link>
            </p>
          </Stack>
        </ContentContainer>
      </footer>
    </ContestShell>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <Surface padding="md" className="fr-contest-details">
      <details>
        <summary>{q}</summary>
        <p className="fr-type-body-small">{a}</p>
      </details>
    </Surface>
  );
}
