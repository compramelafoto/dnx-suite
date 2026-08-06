import Link from "next/link";
import type { PublicHomeContestCard } from "../../lib/fotorank/publicContests";
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

function fmtDeadline(d: Date | null): string | null {
  if (!d) return null;
  try {
    return d.toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return null;
  }
}

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
      {/* Hero — participante primero */}
      <section className="fr-public-section border-b-0 pb-0" aria-labelledby="home-hero-title">
        <PageContainer className="py-16 md:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <p className="fr-public-eyebrow">Concursos fotográficos</p>
            <h1
              id="home-hero-title"
              className="fr-public-title fr-public-stack-title text-3xl md:text-5xl lg:text-[3.25rem]"
            >
              Encontrá convocatorias abiertas y presentá tu obra con claridad
            </h1>
            <p className="fr-public-body fr-public-stack-title mx-auto max-w-2xl text-base md:text-lg">
              FotoRank publica concursos de instituciones y organizaciones. Inscribite, seguí tu
              participación y cargá tu fotografía cuando la convocatoria lo habilite.
            </p>
            <div className="fr-public-stack-actions flex flex-col items-center justify-center gap-4 sm:flex-row">
              <PrimaryButton href="#concursos" size="lg">
                Ver concursos
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
                const deadline = fmtDeadline(c.submissionDeadline);
                return (
                  <li key={c.slug}>
                    <Link
                      href={`/concursos/${c.slug}`}
                      className="fr-public-card group flex flex-col gap-6 transition-colors hover:border-[var(--border-strong)] sm:flex-row sm:items-center sm:justify-between"
                      data-testid="home-contest-card"
                    >
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
