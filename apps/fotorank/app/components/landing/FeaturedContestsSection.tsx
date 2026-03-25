"use client";

import { SectionTitle } from "./SectionTitle";
import { ContestListItem, type ContestItem } from "./ContestListItem";
import { Button } from "./Button";

const featuredContests: ContestItem[] = [
  {
    slug: "naturaleza-2025",
    number: "01",
    name: "Naturaleza 2025",
    category: "Paisaje · Fauna · Flora",
    status: "Abierto",
  },
  {
    slug: "retratos-blanco-y-negro",
    number: "02",
    name: "Retratos en Blanco y Negro",
    category: "Retrato artístico",
    status: "Próximamente",
  },
  {
    slug: "street-photography-awards",
    number: "03",
    name: "Street Photography Awards",
    category: "Documental · Urbano",
    status: "Finalizado",
  },
];

export function FeaturedContestsSection() {
  return (
    <section id="ejemplos" className="fr-section border-t border-[#1a1a1a]">
      <div className="fr-container mx-auto w-full">
        <SectionTitle
          title="Así puede verse tu próximo concurso"
          className="mb-32 text-center md:mb-48"
        />

        <div className="flex justify-center">
          <p className="mb-40 max-w-[36rem] text-center fr-body-large text-[#a1a1a1] leading-relaxed md:mb-64">
            Concursos creados en la plataforma. Una idea de cómo se presenta todo
            cuando está bien organizado.
          </p>
        </div>

        <div className="pt-12 md:pt-16">
          {featuredContests.map((contest, i) => (
            <ContestListItem key={contest.slug} contest={contest} index={i} />
          ))}
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
