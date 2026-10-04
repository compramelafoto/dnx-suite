import Link from "next/link";

import { PageContainer, PublicSectionHeader } from "../public-ui";

import {
  formatoDeSeccionDeJurados,
  TOPE_PARA_GRILLA,
} from "../../lib/fotorank/judges/judgesSectionLayout";
import type { PublicContestJudgeCard } from "../../lib/fotorank/publicContestLanding";

/**
 * Los jurados confirmados de un concurso.
 *
 * Con más de seis pasa a carrusel. **Sin JavaScript sigue siendo una lista con
 * scroll horizontal**: el desplazamiento lo hace el navegador, no un script.
 */
export function ContestJudgesSection({
  judges,
  contestSlug,
}: {
  judges: PublicContestJudgeCard[];
  contestSlug: string;
}) {
  if (judges.length === 0) return null;

  const formato = formatoDeSeccionDeJurados(judges.length);
  const esCarrusel = formato === "carrusel";

  return (
    <section className="fr-public-section" id="jurado">
      <PageContainer>
        <PublicSectionHeader
          title="Jurado"
          action={
            <Link
              href={`/concursos/${contestSlug}/jurados`}
              className="text-sm font-medium text-[var(--primary)] hover:underline"
            >
              Ver todos
            </Link>
          }
        />

        <ul
          className={
            esCarrusel
              ? "fr-public-stack-content flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4"
              : "fr-public-stack-content fr-public-card-grid sm:grid-cols-2 lg:grid-cols-3"
          }
          // Con carrusel se puede recorrer con el teclado.
          tabIndex={esCarrusel ? 0 : undefined}
          aria-label={esCarrusel ? `Jurados del concurso, ${judges.length} en total` : undefined}
        >
          {judges.map((j) => (
            <li
              key={j.publicSlug}
              className={esCarrusel ? "w-64 shrink-0 snap-start" : undefined}
            >
              <Link
                href={`/jurados/publico/${j.publicSlug}`}
                className="fr-public-card group block h-full transition-colors hover:border-[var(--primary)]"
              >
                <div className="flex flex-col items-center text-center">
                  {j.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={j.avatarUrl}
                      alt=""
                      className="h-28 w-28 rounded-full border border-[var(--border)] object-cover"
                    />
                  ) : (
                    <div className="flex h-28 w-28 items-center justify-center rounded-full border border-dashed border-[var(--border)] text-lg font-semibold text-[var(--foreground-muted)]">
                      {j.firstName[0]}
                      {j.lastName[0]}
                    </div>
                  )}

                  <h3 className="mt-4 text-lg font-semibold text-[var(--foreground)] group-hover:text-[var(--primary)]">
                    {j.firstName} {j.lastName}
                  </h3>

                  {j.professionalHeadline ? (
                    <p className="mt-1 text-sm font-medium text-[var(--primary)]">
                      {j.professionalHeadline}
                    </p>
                  ) : null}

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

        {esCarrusel ? (
          <p className="mt-2 text-xs text-[var(--foreground-muted)]">
            {judges.length} jurados. Deslizá para ver el resto.
          </p>
        ) : null}
      </PageContainer>
    </section>
  );
}

export { TOPE_PARA_GRILLA };
