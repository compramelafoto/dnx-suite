"use client";

import { motion } from "framer-motion";
import { SectionTitle } from "./SectionTitle";

const concepts = [
  "Ranking global",
  "Reconocimiento",
  "Diplomas",
  "Categorías",
  "Visibilidad",
];

export function RankingSection() {
  return (
    <section
      id="ranking"
      className="relative overflow-hidden border-t border-[#262626] px-6 py-24 md:px-12 lg:px-24"
    >
      {/* Grid sutil de fondo */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(#fff 1px, transparent 1px),
            linear-gradient(90deg, #fff 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
        }}
      />

      <div className="relative mx-auto max-w-6xl">
        <SectionTitle
          title="Ranking, reconocimiento y visibilidad"
          className="mb-40 md:mb-64"
        />

        <div className="flex flex-wrap gap-8 md:gap-14">
          {concepts.map((concept, i) => (
            <motion.div
              key={concept}
              className="flex items-baseline gap-4"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-30px" }}
              transition={{
                duration: 0.4,
                delay: i * 0.1,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <span className="font-sans text-4xl font-semibold text-[#404040] md:text-5xl lg:text-6xl">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="font-sans text-xl font-medium leading-[1.2] text-[#fafafa] md:text-2xl">
                {concept}
              </span>
            </motion.div>
          ))}
        </div>

        <motion.p
          className="mt-16 max-w-2xl text-lg text-[#a1a1a1]"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          Un sistema de ranking transparente que posiciona a los mejores
          fotógrafos. Diplomas oficiales, categorías profesionales y visibilidad
          para quienes compiten al más alto nivel.
        </motion.p>
      </div>
    </section>
  );
}
