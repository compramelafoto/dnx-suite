import Link from "next/link";
import type { PublicHomeContestCard } from "../../lib/fotorank/publicContests";
import { PhotoBanner } from "../landing/PhotoBanner";
import {
  EmptyState,
  PageContainer,
  PrimaryButton,
  PublicSectionHeader,
  PublicShell,
  SecondaryButton,
  StatusBadge,
} from "../public-ui";
import type { PublicHeaderProps } from "../public-ui/PublicHeader";

type Props = {
  contests: PublicHomeContestCard[];
  header: PublicHeaderProps;
};

/**
 * La fecha ya viene resuelta en `registrationCloseLabel`, con la misma regla de
 * presentación que usa la landing. Antes se formateaba acá el instante crudo de
 * `submissionDeadline`, que para Santa Fe en Foco es el cierre EXCLUSIVO
 * (1-oct 00:00) y mostraba "1 de octubre de 2026" mientras la landing mostraba
 * "30 de septiembre de 2026" para el mismo concurso.
 */

function statusTone(label: PublicHomeContestCard["statusLabel"]) {
  if (label === "Inscripciones abiertas") return "primary" as const;
  if (label === "Próximamente") return "neutral" as const;
  return "neutral" as const;
}

/**
 * Home pública completa — sistema public-ui (sin componentes landing legacy).
 */
export function HomeView({ contests, header }: Props) {
  return (
    <PublicShell
      header={{ ...header, variant: "marketing" }}
      showFooter
      mainClassName="pt-[4.5rem] md:pt-[5.5rem] lg:pt-[6.5rem]"
    >
      {/**
       * Franja de fotografías en blanco y negro sobre el hero. El componente ya
       * existía en el repositorio pero quedó sin montar al migrar la home a
       * public-ui: no es un rediseño, es el mismo `PhotoBanner` que la home
       * usaba antes (restaurado en 63e10473, nunca integrado a esta línea).
       */}
      <PhotoBanner />

      {/**
       * La home se dirige a DOS públicos, no a uno. El hero anterior sólo
       * hablaba de participar, y dejaba fuera a quien quiere organizar un
       * concurso — que es la otra mitad del producto y no tiene costo.
       *
       * La estructura de dos secciones ("Para organizaciones" / "Para
       * participantes") es la que ya tenía la home en f020e750; se recupera con
       * su copy en lugar de redactar uno nuevo. Lo único que se agrega es que
       * organizar es gratis, que antes no se decía en ningún lado.
       */}

      {/* Sección 1 — Organizaciones */}
      <section
        className="fr-public-section border-b border-[var(--border)] pb-0"
        aria-labelledby="home-org-title"
        id="organizar"
      >
        <PageContainer className="py-16 md:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <p className="fr-public-eyebrow">Para organizaciones</p>
            <h1
              id="home-org-title"
              className="fr-public-title fr-public-stack-title text-balance text-3xl md:text-5xl lg:text-[3.25rem]"
            >
              Organizá tu concurso fotográfico gratis, sin desorden ni procesos manuales
            </h1>
            <p className="fr-public-body fr-public-stack-title mx-auto max-w-2xl text-balance text-base md:text-lg">
              Publicar una convocatoria en FotoRank no tiene costo. Cargá categorías, bases y
              fechas en un solo lugar, ordená las inscripciones y presentá los resultados con
              claridad institucional.
            </p>
            <div className="fr-public-stack-actions flex flex-col items-center justify-center gap-4 sm:flex-row">
              <PrimaryButton href="/dashboard" size="lg">
                Organizar un concurso
              </PrimaryButton>
              <SecondaryButton href="#que-es" size="lg">
                Cómo funciona
              </SecondaryButton>
            </div>
          </div>
        </PageContainer>
      </section>

      {/* Sección 2 — Participantes */}
      <section
        className="fr-public-section border-b-0 pb-0"
        aria-labelledby="home-participant-title"
        id="participar"
      >
        <PageContainer className="py-16 md:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <p className="fr-public-eyebrow">Para fotógrafas y fotógrafos</p>
            <h2
              id="home-participant-title"
              className="fr-public-title fr-public-stack-title text-balance text-3xl md:text-4xl lg:text-5xl"
            >
              Encontrá convocatorias abiertas y presentá tu obra con claridad
            </h2>
            <p className="fr-public-body fr-public-stack-title mx-auto max-w-2xl text-balance text-base md:text-lg">
              Inscribite, seguí el estado de tu participación y cargá tu fotografía cuando la
              convocatoria lo habilite.
            </p>
            <div className="fr-public-stack-actions flex flex-col items-center justify-center gap-4 sm:flex-row">
              <PrimaryButton href="#concursos" size="lg">
                Participar de un concurso
              </PrimaryButton>
              <SecondaryButton href="#como-participar" size="lg">
                Cómo participar
              </SecondaryButton>
            </div>
          </div>
        </PageContainer>
      </section>

      {/* Concursos disponibles — prioridad visual */}
      <section className="fr-public-section" id="concursos" aria-labelledby="home-contests-title">
        <PageContainer>
          <PublicSectionHeader
            titleId="home-contests-title"
            eyebrow="Convocatorias"
            title="Concursos disponibles"
            description="Inscripciones abiertas o próximas. Elegí un concurso para ver bases, categorías y fechas."
          />
          {contests.length === 0 ? (
            <EmptyState
              className="fr-public-stack-content"
              title="No hay convocatorias publicadas ahora"
              description="Cuando una organización publique un concurso, va a aparecer aquí."
              action={<SecondaryButton href="/login">Iniciar sesión</SecondaryButton>}
            />
          ) : (
            <ul className="fr-public-stack-content fr-public-card-stack" data-testid="home-contests-list">
              {contests.map((c) => {
                const deadline = c.registrationCloseLabel;
                return (
                  <li key={c.slug}>
                    <Link
                      href={`/concursos/${c.slug}`}
                      className="fr-public-card group flex flex-col gap-6 transition-colors hover:border-[var(--border-strong)] sm:flex-row sm:items-center sm:justify-between"
                      data-testid="home-contest-card"
                    >
                      {/**
                       * Imagen del concurso: viene resuelta del servidor con la
                       * misma precedencia que la landing (manifiesto curado →
                       * portada configurada → ninguna). Si no hay, la tarjeta
                       * queda tipográfica, que es un estado válido y no un error.
                       *
                       * `width`/`height` fijan la proporción para que el navegador
                       * reserve el espacio y no haya salto de layout al cargar.
                       */}
                      {c.heroImageUrl ? (
                        <span className="block shrink-0 overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] sm:order-first">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={c.heroImageUrl}
                            alt={c.heroImageAlt}
                            width={320}
                            height={180}
                            loading="lazy"
                            decoding="async"
                            className="h-32 w-full object-cover sm:h-20 sm:w-36"
                            data-testid="home-contest-card-image"
                          />
                        </span>
                      ) : null}
                      <div className="min-w-0 flex-1 space-y-3">
                        <StatusBadge
                          label={c.statusLabel}
                          tone={statusTone(c.statusLabel)}
                          stateText="Estado"
                        />
                        <h3 className="text-xl font-semibold tracking-tight text-[var(--foreground)] group-hover:text-[var(--primary)] md:text-2xl">
                          {c.title}
                        </h3>
                        <p className="fr-public-body text-sm">
                          Organiza {c.organizerName}
                          {c.categoriesCount > 0 ? ` · ${c.categoriesCount} categorías` : null}
                          {deadline ? ` · Cierre ${deadline}` : null}
                        </p>
                      </div>
                      <span className="fr-public-btn fr-public-btn--primary shrink-0 self-start sm:self-center">
                        {c.statusLabel === "Inscripciones abiertas" ? "Participar" : "Ver detalles"}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </PageContainer>
      </section>

      {/* Qué es */}
      <section className="fr-public-section" id="que-es" aria-labelledby="home-about-title">
        <PageContainer>
          <PublicSectionHeader
            titleId="home-about-title"
            title="Qué es FotoRank"
            description="Una plataforma para publicar y gestionar concursos fotográficos con inscripción, seguimiento de participación y presentación de obras."
          />
          <div className="fr-public-stack-content fr-public-card-grid md:grid-cols-3">
            {[
              {
                t: "Para participantes",
                d: "Inscribite, revisá requisitos y presentá tu fotografía cuando se habilite la carga.",
              },
              {
                t: "Para organizaciones",
                d: "Publicá la convocatoria, categorías, bases y fechas en un solo lugar.",
              },
              {
                t: "Proceso claro",
                d: "Cada persona ve el estado de su participación y el próximo paso, sin jerga técnica.",
              },
            ].map((item) => (
              <article key={item.t} className="fr-public-card">
                <h3 className="text-lg font-semibold text-[var(--foreground)]">{item.t}</h3>
                <p className="fr-public-body fr-public-stack-title text-sm">{item.d}</p>
              </article>
            ))}
          </div>
        </PageContainer>
      </section>

      {/* Cómo participar */}
      <section className="fr-public-section" id="como-participar" aria-labelledby="home-how-title">
        <PageContainer>
          <PublicSectionHeader
            titleId="home-how-title"
            title="Cómo participar"
            description="Cuatro pasos. El orden puede variar según el concurso, pero la idea es siempre la misma."
          />
          <ol className="fr-public-stack-content fr-public-card-grid md:grid-cols-2">
            {[
              ["1", "Elegí un concurso publicado y leé las bases."],
              ["2", "Creá tu cuenta o iniciá sesión."],
              ["3", "Completá la inscripción y los consentimientos."],
              ["4", "Cuando se habilite, cargá y confirmá tu fotografía."],
            ].map(([n, text]) => (
              <li key={n} className="fr-public-card flex items-start gap-5">
                <span
                  className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-[var(--border-strong)] text-sm font-bold text-[var(--foreground)]"
                  aria-hidden
                >
                  {n}
                </span>
                <p className="fr-public-body pt-1.5 text-[var(--foreground)]">{text}</p>
              </li>
            ))}
          </ol>
        </PageContainer>
      </section>

      {/* Confianza */}
      <section className="fr-public-section" id="confianza" aria-labelledby="home-trust-title">
        <PageContainer>
          <PublicSectionHeader
            titleId="home-trust-title"
            title="Participación con reglas claras"
            description="Las bases, fechas y consentimientos se muestran en cada concurso. Lo obligatorio y lo opcional quedan separados."
          />
          <div className="fr-public-stack-content fr-public-card-grid sm:grid-cols-2">
            {[
              "Bases y privacidad accesibles antes de confirmar",
              "Estado de inscripción y de obra en lenguaje comprensible",
              "Carga de fotografías solo cuando el concurso lo habilita",
              "Organizador institucional visible en la página del concurso",
            ].map((line) => (
              <div key={line} className="fr-public-card">
                <p className="fr-public-body text-[var(--foreground)]">{line}</p>
              </div>
            ))}
          </div>
        </PageContainer>
      </section>

      {/* CTA final */}
      <section className="fr-public-section border-b-0" aria-labelledby="home-final-cta">
        <PageContainer>
          <div className="fr-public-card fr-public-cta-band">
            <p className="fr-public-eyebrow">Empezá por un concurso</p>
            <h2 id="home-final-cta" className="fr-public-title text-2xl md:text-3xl">
              Revisá las convocatorias abiertas
            </h2>
            <p className="fr-public-body">
              Si ya estás inscripto/a, podés seguir tu participación desde tu cuenta.
            </p>
            <div className="fr-public-cta-actions flex-col sm:flex-row">
              <PrimaryButton href="#concursos" size="lg">
                Ver concursos
              </PrimaryButton>
              <SecondaryButton href="/participaciones" size="lg">
                Mis participaciones
              </SecondaryButton>
            </div>
          </div>
        </PageContainer>
      </section>
    </PublicShell>
  );
}
