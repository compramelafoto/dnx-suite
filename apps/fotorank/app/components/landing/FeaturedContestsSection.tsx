"use client";

import { SectionTitle } from "./SectionTitle";
import { ContestListItem, type ContestItem } from "./ContestListItem";
import { Button } from "./Button";
import type { PublicHomeContestCard } from "../../lib/fotorank/publicContests";

function fmtDate(d: Date | null): string | null {
  if (!d) return null;
  try {
    return d.toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return null;
  }
}

export function FeaturedContestsSection({ contests }: { contests: PublicHomeContestCard[] }) {
  const featuredContests: ContestItem[] = contests.map((c, i) => ({
    slug: c.slug,
    number: String(i + 1).padStart(2, "0"),
    name: c.title,
    category: `${c.categoriesCount || "Sin"} categoría${c.categoriesCount === 1 ? "" : "s"}`,
    status: c.statusLabel,
    organizerName: c.organizerName,
    deadlineLabel: fmtDate(c.submissionDeadline) ? `Cierre: ${fmtDate(c.submissionDeadline)}` : undefined,
    ctaLabel: c.statusLabel === "Inscripciones abiertas" ? "Participar" : "Ver detalles",
  }));

  return (
    <section id="ejemplos" className="fr-section border-t border-[#1a1a1a]">
      <div className="fr-container mx-auto w-full">
        <SectionTitle
          title="Concursos públicos abiertos"
          className="mb-32 text-center md:mb-48"
        />

        <div className="flex justify-center">
          <p className="mb-40 max-w-[36rem] text-center fr-body-large text-[#a1a1a1] leading-relaxed md:mb-64">
            Convocatorias públicas abiertas para descubrir, comparar y participar desde su landing oficial.
          </p>
        </div>

        <div className="pt-12 md:pt-16">
          {featuredContests.length === 0 ? (
            <p className="text-center text-sm text-[#a1a1a1]">No hay concursos públicos abiertos en este momento.</p>
          ) : (
            featuredContests.map((contest, i) => <ContestListItem key={contest.slug} contest={contest} index={i} />)
          )}
        </div>

        <div className="mt-40 flex flex-wrap items-center justify-center gap-6 md:mt-64">
          <Button href="/dashboard" variant="primary">
            Crear concurso
          </Button>
          <Button href="/concursos" variant="secondary">
            Ver todos los concursos
          </Button>
        </div>
      </div>
    </section>
  );
}
