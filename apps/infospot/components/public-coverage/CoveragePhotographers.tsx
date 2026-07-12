import Link from "next/link";
import type { PublicCoveragePhotographer } from "@/lib/public-coverage";

type Props = {
  photographers: PublicCoveragePhotographer[];
};

/** Bloque «Fotógrafos de esta cobertura» — multi-autor, sin atribuir galería a uno solo. */
export function CoveragePhotographers({ photographers }: Props) {
  if (photographers.length === 0) return null;

  return (
    <section className="mt-14" aria-labelledby="coverage-photographers-heading" data-testid="coverage-photographers">
      <h2 id="coverage-photographers-heading" className="is-title-section text-2xl">
        Fotógrafos de esta cobertura
      </h2>
      <ul className="mt-6 grid gap-4 sm:grid-cols-2">
        {photographers.map((p) => (
          <li
            key={`${p.clfUserId}-${p.displayName}`}
            className="rounded-[var(--is-radius)] border border-[var(--is-border)] bg-[var(--is-surface)] p-5"
          >
            <p className="font-semibold text-[var(--is-text)]">{p.displayName}</p>
            <p className="mt-1 text-sm text-[var(--is-muted)]">
              {p.photoCount} foto{p.photoCount === 1 ? "" : "s"} editorial
              {p.photoCount === 1 ? "" : "es"}
              {p.role && p.role !== "CONTRIBUTOR" ? ` · ${p.role}` : ""}
            </p>
            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              {p.albumHref ? (
                <a
                  href={p.albumHref}
                  className="font-medium text-[var(--is-accent)] hover:underline"
                  rel="noopener noreferrer"
                >
                  Ver álbum
                </a>
              ) : null}
              {p.profileHref ? (
                <Link
                  href={p.profileHref}
                  className="font-medium text-[var(--is-accent)] hover:underline"
                >
                  Perfil
                </Link>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
