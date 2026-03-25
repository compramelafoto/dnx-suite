import Image from "next/image";
import Link from "next/link";
import type { PublicContestLandingData } from "../../lib/fotorank/publicContestLanding";

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
  const h = t.replace(/^@/, "");
  return `https://instagram.com/${h}`;
}

const sectionClass = "fr-section border-b border-fr-border py-16 md:py-20";
const containerClass = "fr-container-wide mx-auto px-8 md:px-10 lg:px-12";
const h2Class = "font-sans text-2xl font-semibold tracking-tight text-fr-primary md:text-3xl";

export function ContestPublicLanding({ data }: { data: PublicContestLandingData }) {
  const { contest, organization: org, judges } = data;
  const heroImage = contest.coverImageUrl ?? org.coverImageUrl ?? null;
  const loginNext = `/concursos/${contest.slug}`;
  const inscripcionHref = `/login?next=${encodeURIComponent(loginNext)}`;

  const categoriasCount = contest.categories.length;
  const maxObrasHint =
    categoriasCount > 0
      ? `Total de obras posibles sumando categorías: hasta ${contest.categories.reduce((s, c) => s + c.maxFiles, 0)} archivo(s) (cada categoría tiene su límite).`
      : null;

  return (
    <div className="min-h-screen bg-fr-bg text-fr-primary">
      {/* 1. Hero */}
      <section className="relative min-h-[72vh] overflow-hidden md:min-h-[78vh]">
        {heroImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- URLs arbitrarias
          <img src={heroImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div
            className="absolute inset-0 bg-gradient-to-br from-zinc-900 via-fr-bg to-zinc-950"
            aria-hidden
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-fr-bg via-fr-bg/85 to-fr-bg/20" aria-hidden />
        <div className={`relative z-10 flex min-h-[72vh] flex-col justify-end pb-16 pt-28 md:min-h-[78vh] md:pb-24 md:pt-32 ${containerClass}`}>
          <div className="max-w-3xl space-y-6">
            <div className="flex flex-wrap items-center gap-4">
              {org.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={org.logoUrl} alt="" className="h-12 w-auto max-w-[140px] object-contain md:h-14" />
              ) : (
                <span className="rounded-lg border border-fr-border bg-fr-card/80 px-3 py-1.5 text-sm font-medium text-fr-primary backdrop-blur">
                  {org.name}
                </span>
              )}
              <span className="text-xs font-medium uppercase tracking-wider text-fr-muted-soft">
                Organiza
              </span>
            </div>
            <h1 className="font-sans text-3xl font-semibold leading-[1.08] tracking-tight text-fr-primary md:text-5xl lg:text-6xl">
              {contest.title}
            </h1>
            {contest.shortDescription ? (
              <p className="max-w-2xl text-lg leading-relaxed text-fr-muted md:text-xl">{contest.shortDescription}</p>
            ) : null}
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Link
                href={inscripcionHref}
                id="inscribirse"
                className="fr-btn fr-btn-primary inline-flex justify-center px-8 py-4 text-center text-base font-semibold shadow-lg shadow-black/30"
              >
                Inscribirme
              </Link>
              <a
                href="#bases"
                className="fr-btn fr-btn-secondary inline-flex justify-center px-8 py-4 text-center text-base font-semibold"
              >
                Ver bases
              </a>
            </div>
            <p className="text-xs text-fr-muted-soft">
              Gestionado con{" "}
              <Link href="/" className="text-gold hover:text-gold-hover">
                FotoRank
              </Link>{" "}
              · plataforma profesional para concursos fotográficos
            </p>
          </div>
        </div>
      </section>

      {/* 2. Resumen rápido */}
      <section className={sectionClass}>
        <div className={containerClass}>
          <h2 className={h2Class}>En resumen</h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <ResumenItem label="Apertura" value={fmtDate(contest.startAt)} />
            <ResumenItem label="Cierre de inscripción" value={fmtDate(contest.submissionDeadline)} />
            <ResumenItem label="Categorías" value={categoriasCount ? String(categoriasCount) : "—"} />
            <ResumenItem label="Evaluación" value={fmtDate(contest.judgingStartAt)} />
            <ResumenItem label="Resultados" value={fmtDate(contest.resultsAt)} />
            <ResumenItem label="Inscripción" value="Consultá bases" />
          </div>
          <div className="mt-10">
            <Link href={inscripcionHref} className="fr-btn fr-btn-primary inline-flex px-8 py-3">
              Quiero inscribirme
            </Link>
          </div>
        </div>
      </section>

      {/* 3. Quién organiza */}
      <section className={sectionClass} id="organizador">
        <div className={containerClass}>
          <h2 className={h2Class}>Quién organiza</h2>
          <div className="mt-10 fr-recuadro flex flex-col gap-8 md:flex-row md:items-start md:gap-12">
            <div className="flex shrink-0 justify-center md:w-48">
              {org.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={org.logoUrl} alt="" className="h-24 w-auto max-w-full object-contain md:h-32" />
              ) : (
                <div className="flex h-24 w-full max-w-[12rem] items-center justify-center rounded-xl border border-dashed border-fr-border text-center text-sm text-fr-muted md:h-32">
                  {org.name}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-4">
              <h3 className="text-xl font-semibold text-fr-primary">{org.name}</h3>
              {org.shortDescription ? (
                <p className="text-fr-muted leading-relaxed">{org.shortDescription}</p>
              ) : null}
              <ul className="flex flex-col gap-2 text-sm text-fr-muted">
                {[org.city, org.country].filter(Boolean).length > 0 ? (
                  <li>
                    <span className="text-fr-muted-soft">Ubicación: </span>
                    {[org.city, org.country].filter(Boolean).join(", ")}
                  </li>
                ) : null}
                {org.contactEmail ? (
                  <li>
                    <a href={`mailto:${org.contactEmail}`} className="text-gold hover:text-gold-hover">
                      {org.contactEmail}
                    </a>
                  </li>
                ) : null}
                {org.phone ? (
                  <li>
                    <a href={`tel:${org.phone.replace(/\s/g, "")}`} className="text-gold hover:text-gold-hover">
                      {org.phone}
                    </a>
                  </li>
                ) : null}
                {org.whatsapp ? (
                  <li>
                    <span className="text-fr-muted-soft">WhatsApp: </span>
                    <span className="text-fr-primary">{org.whatsapp}</span>
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
          </div>
        </div>
      </section>

      {/* 4. Sobre el concurso */}
      {contest.fullDescription ? (
        <section className={sectionClass} id="sobre">
          <div className={containerClass}>
            <h2 className={h2Class}>Sobre el concurso</h2>
            <div className="mt-10 max-w-3xl whitespace-pre-wrap text-base leading-relaxed text-fr-muted">
              {contest.fullDescription}
            </div>
          </div>
        </section>
      ) : null}

      {/* 5. Categorías */}
      {contest.categories.length > 0 ? (
        <section className={sectionClass} id="categorias">
          <div className={containerClass}>
            <h2 className={h2Class}>Categorías</h2>
            <ul className="mt-10 grid gap-6 md:grid-cols-2">
              {contest.categories.map((c) => (
                <li key={c.id} className="fr-recuadro border border-fr-border">
                  <h3 className="text-lg font-semibold text-fr-primary">{c.name}</h3>
                  {c.description ? (
                    <p className="mt-3 text-sm leading-relaxed text-fr-muted">{c.description}</p>
                  ) : (
                    <p className="mt-3 text-sm text-fr-muted-soft">Hasta {c.maxFiles} obra(s) por participante.</p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {/* 6. Premios */}
      {contest.prizesSummary ? (
        <section className={sectionClass} id="premios">
          <div className={containerClass}>
            <h2 className={h2Class}>Premios y beneficios</h2>
            <div className="mt-10 max-w-3xl whitespace-pre-wrap text-fr-muted leading-relaxed">{contest.prizesSummary}</div>
            <div className="mt-8">
              <Link href={inscripcionHref} className="fr-btn fr-btn-primary inline-flex px-8 py-3">
                Inscribirme ahora
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      {/* Sponsors */}
      {contest.sponsorsText ? (
        <section className={sectionClass} id="sponsors">
          <div className={containerClass}>
            <h2 className={h2Class}>Sponsors y apoyos</h2>
            <div className="mt-10 max-w-3xl whitespace-pre-wrap text-fr-muted leading-relaxed">{contest.sponsorsText}</div>
          </div>
        </section>
      ) : null}

      {/* 7. Jurado */}
      {judges.length > 0 ? (
        <section className={sectionClass} id="jurado">
          <div className={containerClass}>
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <h2 className={h2Class}>Jurado</h2>
              <Link
                href={`/concursos/${contest.slug}/jurados`}
                className="text-sm font-medium text-gold hover:text-gold-hover"
              >
                Ver todos →
              </Link>
            </div>
            <ul className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {judges.map((j) => (
                <li key={j.publicSlug}>
                  <Link
                    href={`/jurados/publico/${j.publicSlug}`}
                    className="group block fr-recuadro border border-fr-border transition-colors hover:border-gold/40"
                  >
                    <div className="flex flex-col items-center text-center">
                      {j.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={j.avatarUrl}
                          alt=""
                          className="h-24 w-24 rounded-full border-2 border-fr-border object-cover transition-transform group-hover:scale-[1.02]"
                        />
                      ) : (
                        <div className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-dashed border-fr-border text-fr-muted-soft">
                          {j.firstName[0]}
                          {j.lastName[0]}
                        </div>
                      )}
                      <h3 className="mt-4 text-lg font-semibold text-fr-primary group-hover:text-gold">
                        {j.firstName} {j.lastName}
                      </h3>
                      {j.shortBio ? (
                        <p className="mt-2 line-clamp-3 text-sm text-fr-muted">{j.shortBio}</p>
                      ) : (
                        <p className="mt-2 text-xs text-fr-muted-soft">Ver perfil completo</p>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {/* 8. Cómo participar */}
      <section className={sectionClass} id="como-participar">
        <div className={containerClass}>
          <h2 className={h2Class}>Cómo participar</h2>
          <ol className="mt-10 max-w-2xl list-decimal space-y-4 pl-6 text-fr-muted marker:text-gold">
            <li>Creá tu cuenta o iniciá sesión en FotoRank.</li>
            <li>Elegí las categorías que mejor encuarden con tus obras.</li>
            <li>Subí tus archivos respetando formato y tamaño indicados en las bases.</li>
            <li>Confirmá la inscripción antes del cierre.</li>
          </ol>
          {maxObrasHint ? <p className="mt-6 max-w-2xl text-sm text-fr-muted-soft">{maxObrasHint}</p> : null}
        </div>
      </section>

      {/* 9. Bases */}
      {contest.rulesText ? (
        <section className={sectionClass} id="bases">
          <div className={containerClass}>
            <h2 className={h2Class}>Bases y condiciones</h2>
            <details className="mt-10 fr-recuadro group border border-fr-border">
              <summary className="cursor-pointer text-lg font-medium text-fr-primary">
                Ver bases completas
              </summary>
              <div className="mt-6 max-h-[32rem] overflow-y-auto whitespace-pre-wrap border-t border-fr-border pt-6 text-sm leading-relaxed text-fr-muted">
                {contest.rulesText}
              </div>
            </details>
          </div>
        </section>
      ) : (
        <section className={sectionClass} id="bases">
          <div className={containerClass}>
            <h2 className={h2Class}>Bases y condiciones</h2>
            <p className="mt-6 text-fr-muted">Las bases estarán publicadas próximamente. Contactá al organizador.</p>
          </div>
        </section>
      )}

      {/* 10. FAQ */}
      <section className={sectionClass} id="faq">
        <div className={containerClass}>
          <h2 className={h2Class}>Preguntas frecuentes</h2>
          <div className="mt-10 space-y-4 max-w-3xl">
            <FaqItem
              q="¿Cómo me inscribo?"
              a="Creá una cuenta en FotoRank, iniciá sesión y seguí el flujo de inscripción desde el botón «Inscribirme»."
            />
            <FaqItem
              q="¿Hay costo de inscripción?"
              a="Si el concurso define arancel, figurará en las bases. Si no se indica, asumí que no hay cargo salvo que el organizador lo comunique."
            />
            <FaqItem
              q="¿Cuándo se conocen los resultados?"
              a={fmtDate(contest.resultsAt) ? `Fecha prevista: ${fmtDate(contest.resultsAt)}.` : "La fecha de resultados se comunicará según el cronograma del concurso."}
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
        </div>
      </section>

      {/* 12. CTA final */}
      <section className={`${sectionClass} border-b-0`}>
        <div className={containerClass}>
          <div className="fr-recuadro border border-gold/30 bg-fr-card/80 text-center">
            <h2 className="text-2xl font-semibold text-fr-primary md:text-3xl">Sumate al concurso</h2>
            {contest.submissionDeadline ? (
              <p className="mt-4 text-fr-muted">
                Inscripciones hasta el <strong className="text-fr-primary">{fmtDate(contest.submissionDeadline)}</strong>
              </p>
            ) : null}
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link href={inscripcionHref} className="fr-btn fr-btn-primary px-10 py-4 text-base font-semibold">
                Inscribirme
              </Link>
              <Link href="/" className="text-sm text-fr-muted hover:text-gold">
                Conocer FotoRank
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-fr-border py-10">
        <div className={`${containerClass} flex flex-col items-center gap-4 text-center text-sm text-fr-muted`}>
          <Link href="/" className="inline-flex items-center gap-2 text-fr-muted hover:text-gold">
            <Image src="/fotorank-logo.png" alt="FotoRank" width={120} height={40} className="h-8 w-auto opacity-80" />
          </Link>
          <p>
            Concurso organizado por <strong className="text-fr-primary">{org.name}</strong>. Plataforma{" "}
            <Link href="/" className="text-gold">
              FotoRank
            </Link>
            .
          </p>
        </div>
      </footer>
    </div>
  );
}

function ResumenItem({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-xl border border-fr-border bg-fr-card/40 px-5 py-4">
      <p className="text-xs font-medium uppercase tracking-wide text-fr-muted-soft">{label}</p>
      <p className="mt-2 text-lg font-semibold text-fr-primary">{value ?? "—"}</p>
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="fr-recuadro border border-fr-border">
      <summary className="cursor-pointer font-medium text-fr-primary">{q}</summary>
      <p className="mt-4 text-sm leading-relaxed text-fr-muted">{a}</p>
    </details>
  );
}
