"use client";

import { motion } from "framer-motion";
import { SectionTitle } from "./SectionTitle";

const features = [
  { label: "Categorías", icon: "folder" },
  { label: "Jurados", icon: "users" },
  { label: "Inscripciones", icon: "edit" },
  { label: "Resultados", icon: "chart" },
  { label: "Diplomas", icon: "award" },
  { label: "Visibilidad del concurso", icon: "eye" },
  { label: "Ventas de obras físicas o digitales", icon: "shopping" },
];

const iconPaths: Record<string, string> = {
  folder: "M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z",
  users: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",
  edit: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z",
  chart: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
  award: "M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 00-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z",
  eye: "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z",
  shopping: "M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z",
};

export function CredibilidadSection() {
  return (
    <section className="fr-section border-t border-[#1a1a1a]">
      <div className="fr-container-content mx-auto w-full text-center">
        <SectionTitle
          title="Pensada para concursos con categorías, jurados, convocatorias y resultados organizados"
          className="mb-32 md:mb-48"
        />

        <motion.p
          className="mb-56 fr-body text-[#a1a1a1] md:mb-80 lg:mb-96"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45 }}
        >
          Todo dentro de una misma experiencia.
        </motion.p>

        <div className="flex flex-wrap justify-center gap-6 pt-8 md:gap-10 md:pt-12">
          {features.map((feature, i) => (
            <motion.div
              key={feature.label}
              className="fr-card flex min-w-[8rem] flex-col items-center gap-3 rounded-md px-6 py-5 md:px-8 md:py-6"
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-24px" }}
              transition={{
                duration: 0.4,
                delay: i * 0.04,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <svg
                className="size-5 text-[#D4AF37]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d={iconPaths[feature.icon]}
                />
              </svg>
              <span className="fr-body-small text-[#fafafa]">{feature.label}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
