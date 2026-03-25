"use client";

import { motion } from "framer-motion";
import { SectionTitle } from "./SectionTitle";

const iconPaths: Record<string, string> = {
  folder: "M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z",
  cog: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z",
  users: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",
  award: "M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 00-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z",
  chart: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
};

const benefits = [
  {
    title: "Más orden en todo el proceso",
    description:
      "Convocatorias, inscripciones y resultados en un solo lugar. Sin archivos dispersos ni seguimiento manual.",
    icon: "folder",
  },
  {
    title: "Menos tareas manuales",
    description:
      "Automatizá la organización de categorías, la asignación de jurados y la publicación de resultados.",
    icon: "cog",
  },
  {
    title: "Mejor experiencia para jurados y participantes",
    description:
      "Interfaz clara para evaluar y participar. Menos consultas repetidas y más tiempo para lo importante.",
    icon: "users",
  },
  {
    title: "Imagen más profesional para tu institución",
    description:
      "Presentá tu concurso con una plataforma cuidada que transmite seriedad y organización.",
    icon: "award",
  },
  {
    title: "Resultados más claros y fáciles de comunicar",
    description:
      "Rankings, diplomas y visibilidad del concurso listos para compartir con tu comunidad.",
    icon: "chart",
  },
];

export function BenefitsSection() {
  return (
    <section id="beneficios" className="fr-section border-t border-[#1a1a1a]">
      <div className="fr-container mx-auto w-full">
        <SectionTitle
          title="¿Por qué organizar tu concurso con FotoRank?"
          className="mb-40 text-center md:mb-64"
        />

        <div className="grid gap-10 md:grid-cols-2 md:gap-12 lg:grid-cols-3">
          {benefits.slice(0, 3).map((benefit, i) => (
            <motion.div
              key={benefit.title}
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
                <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={iconPaths[benefit.icon]} />
                </svg>
              </div>
              <h3 className="fr-title-card text-[#fafafa]">{benefit.title}</h3>
              <p className="mt-5 fr-body-small leading-relaxed text-[#a1a1a1]">{benefit.description}</p>
            </motion.div>
          ))}
          <div className="flex flex-wrap justify-center gap-10 md:col-span-2 md:gap-12 lg:col-span-3 lg:gap-12">
            {benefits.slice(3, 5).map((benefit, i) => (
              <motion.div
                key={benefit.title}
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
                  <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={iconPaths[benefit.icon]} />
                  </svg>
                </div>
                <h3 className="fr-title-card text-[#fafafa]">{benefit.title}</h3>
                <p className="mt-5 fr-body-small leading-relaxed text-[#a1a1a1]">{benefit.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
