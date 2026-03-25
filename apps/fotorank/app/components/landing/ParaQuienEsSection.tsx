"use client";

import { motion } from "framer-motion";
import { SectionTitle } from "./SectionTitle";

const audiences = [
  {
    title: "Asociaciones fotográficas",
    description: "Clubes, federaciones y colectivos que organizan convocatorias para su comunidad.",
  },
  {
    title: "Escuelas y espacios de formación",
    description: "Instituciones educativas que lanzan concursos para estudiantes o egresados.",
  },
  {
    title: "Festivales y ciclos culturales",
    description: "Eventos que incluyen convocatorias fotográficas como parte de su programa.",
  },
  {
    title: "Comunidades de fotógrafos",
    description: "Grupos que quieren organizar muestras o reconocimientos de forma ordenada.",
  },
  {
    title: "Instituciones y proyectos culturales",
    description: "Cualquier entidad que necesite lanzar una convocatoria visual de forma profesional.",
  },
];

function IconUsers() {
  return (
    <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}

export function ParaQuienEsSection() {
  return (
    <section id="para-quien-es" className="fr-section border-t border-[#1a1a1a]">
      <div className="fr-container mx-auto w-full">
        <SectionTitle
          title="¿Para quién es FotoRank?"
          className="mb-40 text-center md:mb-64"
        />

        <div className="grid gap-10 md:grid-cols-2 md:gap-12 lg:grid-cols-3">
          {audiences.slice(0, 3).map((audience, i) => (
            <motion.div
              key={audience.title}
              className="fr-card group"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{
                duration: 0.45,
                delay: i * 0.05,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <div className="mx-auto mb-6 flex size-10 items-center justify-center rounded-md bg-[#D4AF37]/10 text-[#D4AF37] transition-colors group-hover:bg-[#D4AF37]/15">
                <IconUsers />
              </div>
              <h3 className="fr-title-card text-[#fafafa]">{audience.title}</h3>
              <p className="mt-5 fr-body-small leading-relaxed text-[#a1a1a1]">{audience.description}</p>
            </motion.div>
          ))}
          <div className="flex flex-wrap justify-center gap-10 md:col-span-2 md:gap-12 lg:col-span-3 lg:gap-12">
            {audiences.slice(3, 5).map((audience, i) => (
              <motion.div
                key={audience.title}
                className="fr-card group w-full md:w-[calc(50%-1rem)] lg:w-[22rem]"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{
                  duration: 0.45,
                  delay: (i + 3) * 0.05,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                <div className="mx-auto mb-6 flex size-10 items-center justify-center rounded-md bg-[#D4AF37]/10 text-[#D4AF37] transition-colors group-hover:bg-[#D4AF37]/15">
                  <IconUsers />
                </div>
                <h3 className="fr-title-card text-[#fafafa]">{audience.title}</h3>
                <p className="mt-5 fr-body-small leading-relaxed text-[#a1a1a1]">{audience.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
