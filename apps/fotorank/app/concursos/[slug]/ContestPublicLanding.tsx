import Link from "next/link";
import type { PublicContestLandingData } from "../../lib/fotorank/publicContestLanding";
import { parsePrizesRewardsConfig } from "../../lib/fotorank/prizesRewards";
import {
  finalCtaCopy,
  getLandingPhase,
  PHASE_LABEL,
  phaseCta,
} from "../../lib/fotorank/public-ux/contest-landing-phase";
import {
  CategoryCard,
  ContestHero,
  DateCard,
  InfoCard,
  MobileActionBar,
  Notice,
  PageContainer,
  PrimaryButton,
  PublicSectionHeader,
  PublicShell,
  SecondaryButton,
  StatusBadge,
} from "../../components/public-ui";
import { ContestPartnersSection, RulesDocument } from "../../components/contest-public";
import type { PublicPartnerGroup } from "@repo/partners";
import { isSantaFeEnFocoSlug } from "../../lib/fotorank/contest-visual/santa-fe-en-foco";
import type { StatusTone } from "../../lib/fotorank/public-ux/participant-status";

function fmtDate(d: Date | null): string | null {
  if (!d) return null;
  try {
    return d.toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return null;
  }
}

/**
 * Preservado de dcdbda7e (producción, 7 ago): SFEF publicó el cierre de
 * inscripción como "30 de septiembre de 2026" de forma inclusiva, distinto
 * del valor crudo de `submissionDeadline`/`registrationClosesAt`. No es un
 * comportamiento del sistema public-ui — es contenido legal específico de
 * ese concurso que hay que seguir mostrando igual.
 */
function registrationCloseLabel(contest: PublicContestLandingData["contest"]): string | null {
  if (isSantaFeEnFocoSlug(contest.slug)) return "30 de septiembre de 2026";
  return fmtDate(contest.registrationClosesAt ?? contest.submissionDeadline);
}

function igHref(raw: string): string {
  const t = raw.trim();
  if (t.startsWith("http")) return t;
  const h = t.replace(/^@/, "");
  return `https://instagram.com/${h}`;
}

function phaseTone(phase: ReturnType<typeof getLandingPhase>): StatusTone {
  if (phase === "open" || phase === "last-days") return "primary";
  if (phase === "coming-soon") return "neutral";
  if (phase === "in-evaluation") return "warning";
  if (phase === "finalized") return "success";
  return "neutral";
}

export function ContestPublicLanding({
  data,
  partnerGroups = [],
}: {
  data: PublicContestLandingData;
  /** Preservado de dcdbda7e/c3c5b883: `page.tsx` la pasa como [] hoy (welcome
   * institucional se renderiza aparte, vía FotorankContestPartnerWelcome, fuera
   * de este componente) — se mantiene la prop y el render para no romper el tipo
   * ni el contrato existente si en el futuro sí trae contenido. */
  partnerGroups?: PublicPartnerGroup[];
}) {
  const { contest, organization: org, judges } = data;
  const isSfef = contest.slug.trim().toLowerCase() === "santa-fe-en-foco";
  const prConfig = parsePrizesRewardsConfig(contest.rulesData);
  const publicPrizes = prConfig.prizes.filter((p) => p.visiblePublic);
  const publicRewards = prConfig.rewards.filter((r) => r.visiblePublic);
  const hasStructuredPrizes = publicPrizes.length > 0 || publicRewards.length > 0;
  const phase = getLandingPhase({
    status: contest.status,
    startAt: contest.startAt,
    submissionDeadline: contest.submissionDeadline,
    judgingStartAt: contest.judgingStartAt,
    resultsAt: contest.resultsAt,
  });
  const cta = phaseCta(phase);
  const finalCta = finalCtaCopy(phase);
  const sfefBanner = "/contest-assets/santa-fe-en-foco/hero/hero-desktop.jpg";
  const sfefBannerMobile = "/contest-assets/santa-fe-en-foco/hero/hero-mobile.jpg";
  const heroImage = contest.coverImageUrl ?? (isSfef ? sfefBanner : org.coverImageUrl) ?? null;
  const inscripcionHref = `/concursos/${contest.slug}/inscripcion`;
  const categoriasCount = contest.categories.length;
  const maxObrasHint =
    categoriasCount > 0
      ? `Hasta ${contest.categories.reduce((s, c) => s + c.maxFiles, 0)} obra(s) en total según los límites por categoría.`
      : null;

  const primaryCta = cta.enabled ? (
    <PrimaryButton href={inscripcionHref} id="inscribirse" size="lg" data-testid="contest-primary-cta">
      {cta.primary}
    </PrimaryButton>
  ) : (
    <span
      className="fr-public-btn fr-public-btn--secondary opacity-70"
      aria-disabled="true"
      data-testid="contest-primary-cta"
    >
      {cta.primary}
    </span>
  );

  return (
    <PublicShell
      organizationName={org.name}
      supportEmail={org.contactEmail}
      header={{ variant: "contest", panelHref: "/participaciones" }}
      className={isSfef ? "fr-public-shell--sfef" : undefined}
    >
      <ContestHero
        title={contest.title}
        summary={contest.shortDescription}
        phaseLabel={PHASE_LABEL[phase]}
        phaseTone={phaseTone(phase)}
        organizerName={org.name}
        // Branding SFEF (615df551): el banner ya incluye el logo del organizador.
        organizerLogoUrl={isSfef ? null : org.logoUrl}
        // Cierre: registrationCloseLabel() de 8ddcbd0b (mismo resultado para
        // SFEF que el ternario inline de 615df551, sin duplicar la regla).
        deadlineLabel={registrationCloseLabel(contest)}
        heroImageUrl={heroImage}
        heroImageMobileUrl={isSfef ? sfefBannerMobile : heroImage}
        layout={isSfef && heroImage ? "stacked" : "overlay"}
        objectPosition={isSfef ? "78% 45%" : "50% 50%"}
        visibilityNote={
          contest.visibility !== "PUBLIC"
            ? contest.visibility === "UNLISTED"
              ? "Solo por enlace"
              : "Acceso privado"
            : null
        }
        primaryAction={primaryCta}
        secondaryAction={
          <SecondaryButton href="#bases" size="lg">
            Ver bases
          </SecondaryButton>
        }
      />

      <nav
        className="sticky top-[4.5rem] z-20 border-y border-[var(--border)] bg-[rgb(10_10_11_/_0.94)] py-3 backdrop-blur md:top-[5.5rem] lg:top-[6.5rem]"
        aria-label="Secciones del concurso"
      >
        <PageContainer className="overflow-x-auto">
          <ul className="flex min-w-max items-center gap-5 text-sm text-[var(--foreground-muted)]">
            <li>
              <a href="#sobre" className="hover:text-[var(--primary)]">
                Información
              </a>
            </li>
            <li>
              <a href="#como-participar" className="hover:text-[var(--primary)]">
                Cómo participar
              </a>
            </li>
            <li>
              <a href="#categorias" className="hover:text-[var(--primary)]">
                Categorías
              </a>
            </li>
            <li>
              <a href="#cronograma" className="hover:text-[var(--primary)]">
                Fechas
              </a>
            </li>
            {hasStructuredPrizes || contest.prizesSummary ? (
              <li>
                <a href="#premios" className="hover:text-[var(--primary)]">
                  Premios
                </a>
              </li>
            ) : null}
            {judges.length > 0 ? (
              <li>
                <a href="#jurado" className="hover:text-[var(--primary)]">
                  Jurado
                </a>
              </li>
            ) : null}
            <li>
              <a href="#faq" className="hover:text-[var(--primary)]">
                Preguntas
              </a>
            </li>
          </ul>
        </PageContainer>
      </nav>

      <section className="fr-public-section">
        <PageContainer>
          <PublicSectionHeader title="Información esencial" />
          <div className="fr-public-stack-content fr-public-card-grid sm:grid-cols-2 lg:grid-cols-3">
            <InfoCard label="Estado" value={PHASE_LABEL[phase]} accent />
            <InfoCard
              label="Inscripción"
              value="Consultá bases"
              hint="Si el concurso es gratuito o arancelado figura en las bases publicadas."
            />
            <InfoCard label="Categorías" value={categoriasCount ? String(categoriasCount) : "—"} />
            <DateCard label="Apertura" dateLabel={fmtDate(contest.startAt)} />
            <DateCard label="Cierre de inscripción" dateLabel={fmtDate(contest.submissionDeadline)} />
            <DateCard label="Resultados" dateLabel={fmtDate(contest.resultsAt)} />
          </div>
        </PageContainer>
      </section>

      <section className="fr-public-section" id="organizador">
        <PageContainer>
          <PublicSectionHeader title="Organización" />
          <div className="fr-public-card fr-public-stack-content flex flex-col gap-8 md:flex-row md:items-start md:gap-12">
            <div className="flex shrink-0 justify-center md:w-48">
              {org.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={org.logoUrl}
                  alt=""
                  className="h-24 w-auto max-w-full object-contain md:h-32"
                />
              ) : (
                <div className="flex h-24 w-full max-w-[12rem] items-center justify-center rounded-[var(--radius-md)] border border-dashed border-[var(--border)] text-center text-sm text-[var(--foreground-muted)] md:h-32">
                  {org.name}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="fr-public-eyebrow">Organiza</p>
              <h3 className="fr-public-stack-title text-xl font-semibold text-[var(--foreground)]">
                {org.name}
              </h3>
              {org.shortDescription ? (
                <p className="fr-public-body fr-public-stack-title">{org.shortDescription}</p>
              ) : null}
              {contest.slug.trim().toLowerCase() === "santa-fe-en-foco" ? (
                <p className="fr-public-body fr-public-stack-title text-sm text-[var(--foreground-muted)]">
                  Organiza la Sociedad de Fotógrafos Profesionales de Rosario, con la Cámara de
                  Senadores de la Provincia de Santa Fe como entidad organizadora correspondiente.
                </p>
              ) : null}
              <ul className="fr-public-stack-content space-y-3 text-sm text-[var(--foreground-muted)]">
                {[org.city, org.country].filter(Boolean).length > 0 ? (
                  <li>{[org.city, org.country].filter(Boolean).join(", ")}</li>
                ) : null}
                {org.contactEmail ? (
                  <li>
                    <a href={`mailto:${org.contactEmail}`} className="text-[var(--primary)] hover:underline">
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
                      className="text-[var(--primary)] hover:underline"
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
                      className="text-[var(--primary)] hover:underline"
                    >
                      Instagram
                    </a>
                  </li>
                ) : null}
              </ul>
            </div>
          </div>
        </PageContainer>
      </section>

      {contest.fullDescription ? (
        <section className="fr-public-section" id="sobre">
          <PageContainer>
            <PublicSectionHeader title="Sobre el concurso" />
            <div className="fr-public-body fr-public-stack-content fr-public-prose max-w-3xl whitespace-pre-wrap">
              {contest.fullDescription}
            </div>
          </PageContainer>
        </section>
      ) : null}

      <section className="fr-public-section" id="como-participar">
        <PageContainer>
          <PublicSectionHeader title="Cómo participar" />
          <ol className="fr-public-stack-content fr-public-card-grid md:grid-cols-2">
            {[
              ["1", "Creá tu cuenta o iniciá sesión en FotoRank."],
              ["2", "Completá tus datos, categoría y consentimientos."],
              ["3", "Cuando se habilite, cargá tu fotografía según las bases."],
              ["4", "Confirmá la presentación antes del cierre."],
            ].map(([n, text]) => (
              <li key={n} className="fr-public-card flex items-start gap-5">
                <span
                  className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-[var(--primary)] text-sm font-bold text-[var(--primary)]"
                  aria-hidden
                >
                  {n}
                </span>
                <p className="fr-public-body text-[var(--foreground)] leading-[var(--public-leading-relaxed)]">{text}</p>
              </li>
            ))}
          </ol>
          {maxObrasHint ? <p className="fr-public-body fr-public-stack-title max-w-2xl text-sm">{maxObrasHint}</p> : null}
        </PageContainer>
      </section>

      {contest.categories.length > 0 ? (
        <section className="fr-public-section" id="categorias">
          <PageContainer>
            <PublicSectionHeader title="Categorías" />
            <ul className="fr-public-stack-content fr-public-card-grid md:grid-cols-2">
              {contest.categories.map((c) => (
                <li key={c.id}>
                  <CategoryCard name={c.name} description={c.description} maxFiles={c.maxFiles} />
                </li>
              ))}
            </ul>
          </PageContainer>
        </section>
      ) : null}

      {hasStructuredPrizes || contest.prizesSummary ? (
        <section className="fr-public-section" id="premios">
          <PageContainer>
            <PublicSectionHeader title="Premios" />
            {hasStructuredPrizes ? (
              <div className="fr-public-stack-content fr-public-card-stack">
                {(publicPrizes.find((p) => p.isPrimary) ?? publicPrizes[0]) ? (
                  <div className="fr-public-card fr-public-card--accent">
                    <p className="fr-public-eyebrow">Premio principal</p>
                    <h3 className="mt-3 text-2xl font-semibold text-[var(--foreground)]">
                      {(publicPrizes.find((p) => p.isPrimary) ?? publicPrizes[0])?.name}
                    </h3>
                    {(publicPrizes.find((p) => p.isPrimary) ?? publicPrizes[0])?.shortDescription ? (
                      <p className="fr-public-body mt-3">
                        {(publicPrizes.find((p) => p.isPrimary) ?? publicPrizes[0])?.shortDescription}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                <div className="fr-public-card-grid md:grid-cols-2">
                  {publicPrizes.map((p) => (
                    <article key={p.id} className="fr-public-card">
                      <h3 className="text-lg font-semibold text-[var(--foreground)]">{p.name}</h3>
                      {p.shortDescription ? (
                        <p className="fr-public-body mt-2 text-sm">{p.shortDescription}</p>
                      ) : null}
                      {p.sponsorName ? (
                        <p className="mt-3 text-xs text-[var(--foreground-muted)]">
                          Otorgado por {p.sponsorName}
                        </p>
                      ) : null}
                    </article>
                  ))}
                  {publicRewards.map((r) => (
                    <article key={r.id} className="fr-public-card">
                      <h3 className="text-lg font-semibold text-[var(--foreground)]">{r.name}</h3>
                      {r.description ? (
                        <p className="fr-public-body mt-2 text-sm">{r.description}</p>
                      ) : null}
                    </article>
                  ))}
                </div>
              </div>
            ) : (
              <div className="fr-public-body fr-public-stack-content fr-public-prose max-w-3xl whitespace-pre-wrap">
                {contest.prizesSummary}
              </div>
            )}
          </PageContainer>
        </section>
      ) : null}

      <section className="fr-public-section" id="cronograma">
        <PageContainer>
          <PublicSectionHeader title="Fechas importantes" />
          <ol className="fr-public-stack-content fr-public-card-stack">
            {[
              ["Apertura", fmtDate(contest.startAt)],
              ["Cierre de inscripción", fmtDate(contest.submissionDeadline)],
              ["Inicio de evaluación", fmtDate(contest.judgingStartAt)],
              ["Fin de evaluación", fmtDate(contest.judgingEndAt)],
              ["Resultados", fmtDate(contest.resultsAt)],
            ]
              .filter((i) => i[1])
              .map(([label, value]) => (
                <li
                  key={label}
                  className="fr-public-card flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="font-medium text-[var(--foreground)]">{label}</span>
                  <span className="text-[var(--foreground-muted)]">{value}</span>
                </li>
              ))}
          </ol>
        </PageContainer>
      </section>

      {contest.sponsorsText ? (
        <section className="fr-public-section" id="sponsors">
          <PageContainer>
            <PublicSectionHeader title="Sponsors y apoyos" />
            <div className="fr-public-body fr-public-stack-content fr-public-prose max-w-3xl whitespace-pre-wrap">
              {contest.sponsorsText}
            </div>
          </PageContainer>
        </section>
      ) : null}

      {judges.length > 0 ? (
        <section className="fr-public-section" id="jurado">
          <PageContainer>
            <PublicSectionHeader
              title="Jurado"
              action={
                <Link
                  href={`/concursos/${contest.slug}/jurados`}
                  className="text-sm font-medium text-[var(--primary)] hover:underline"
                >
                  Ver todos
                </Link>
              }
            />
            <ul className="fr-public-stack-content fr-public-card-grid sm:grid-cols-2 lg:grid-cols-3">
              {judges.map((j) => (
                <li key={j.publicSlug}>
                  <Link
                    href={`/jurados/publico/${j.publicSlug}`}
                    className="fr-public-card group block transition-colors hover:border-[var(--primary)]"
                  >
                    <div className="flex flex-col items-center text-center">
                      {j.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={j.avatarUrl}
                          alt=""
                          className="h-24 w-24 rounded-full border border-[var(--border)] object-cover"
                        />
                      ) : (
                        <div className="flex h-24 w-24 items-center justify-center rounded-full border border-dashed border-[var(--border)] text-[var(--foreground-muted)]">
                          {j.firstName[0]}
                          {j.lastName[0]}
                        </div>
                      )}
                      <h3 className="mt-4 text-lg font-semibold text-[var(--foreground)] group-hover:text-[var(--primary)]">
                        {j.firstName} {j.lastName}
                      </h3>
                      {j.shortBio ? (
                        <p className="fr-public-body mt-2 line-clamp-3 text-sm">{j.shortBio}</p>
                      ) : (
                        <p className="mt-2 text-xs text-[var(--foreground-muted)]">Ver perfil</p>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </PageContainer>
        </section>
      ) : null}

      <section className="fr-public-section" id="bases">
        <PageContainer>
          <PublicSectionHeader title="Bases y condiciones" />
          {contest.rulesText ? (
            <details className="fr-public-card group fr-public-stack-content">
              <summary className="cursor-pointer text-lg font-medium text-[var(--foreground)]">
                Ver bases completas
              </summary>
              {/* RulesDocument (de dcdbda7e): parser markdown propio para negrita/enlaces/
                  encabezados del texto legal — preservado en vez de whitespace-pre-wrap crudo. */}
              <div className="fr-public-body mt-6 max-h-[32rem] overflow-y-auto border-t border-[var(--border)] pt-6 text-sm">
                <RulesDocument content={contest.rulesText} />
              </div>
            </details>
          ) : (
            <Notice tone="info" className="fr-public-stack-content">
              Las bases estarán publicadas próximamente. Contactá al organizador si necesitás más
              información.
            </Notice>
          )}
        </PageContainer>
      </section>

      {/* ContestPartnersSection ya devuelve null si groups está vacío (caso actual). */}
      <ContestPartnersSection groups={partnerGroups} />

      <section className="fr-public-section" id="faq">
        <PageContainer>
          <PublicSectionHeader title="Preguntas frecuentes" />
          <div className="fr-public-stack-content fr-public-card-stack max-w-3xl">
            <FaqItem
              q="¿Cómo me inscribo?"
              a="Creá una cuenta en FotoRank, iniciá sesión y usá el botón «Inscribirme»."
            />
            <FaqItem
              q="¿Hay costo de inscripción?"
              a="Si el concurso define arancel, figurará en las bases. Si no se indica, consultá con el organizador."
            />
            <FaqItem
              q="¿Cuándo se conocen los resultados?"
              a={
                fmtDate(contest.resultsAt)
                  ? `Fecha prevista: ${fmtDate(contest.resultsAt)}.`
                  : "La fecha de resultados se comunica según el cronograma del concurso."
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
          </div>
        </PageContainer>
      </section>

      <section className="fr-public-section border-b-0" data-testid="contest-final-cta">
        <PageContainer>
          <div className="fr-public-card fr-public-card--accent fr-public-cta-band">
            <StatusBadge label={PHASE_LABEL[phase]} tone={phaseTone(phase)} />
            <h2 className="fr-public-title text-2xl md:text-3xl">{finalCta.title}</h2>
            <p className="fr-public-body">{finalCta.body}</p>
            {registrationCloseLabel(contest) ? (
              <p className="fr-public-cta-meta">
                Inscripciones hasta el{" "}
                <strong className="text-[var(--foreground)]">
                  {registrationCloseLabel(contest)}
                </strong>
              </p>
            ) : null}
            <div className="fr-public-cta-actions flex-col sm:flex-row">
              {cta.enabled ? (
                <PrimaryButton href={inscripcionHref} size="lg">
                  {finalCta.action}
                </PrimaryButton>
              ) : (
                <span className="fr-public-btn fr-public-btn--secondary opacity-70" aria-disabled="true">
                  {finalCta.action}
                </span>
              )}
              <SecondaryButton href="/" size="lg">
                Conocer FotoRank
              </SecondaryButton>
            </div>
          </div>
        </PageContainer>
      </section>

      {cta.enabled ? (
        <MobileActionBar>
          <PrimaryButton href={inscripcionHref} className="w-full" size="lg">
            {cta.primary}
          </PrimaryButton>
        </MobileActionBar>
      ) : null}
    </PublicShell>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="fr-public-card">
      <summary className="cursor-pointer font-medium text-[var(--foreground)]">{q}</summary>
      <p className="fr-public-body fr-public-stack-title text-sm">{a}</p>
    </details>
  );
}
