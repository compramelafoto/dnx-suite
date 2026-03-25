"use client";

import { motion } from "framer-motion";

const lines = [
  "FotoRank conecta fotógrafos, organizadores, jurados e instituciones",
  "en un ecosistema donde el talento se reconoce, se premia y se proyecta.",
  "Una plataforma tecnológica con la seriedad de un certamen de alto nivel.",
];

export function IntroSection() {
  return (
    <section className="border-t border-[#262626] px-6 py-24 md:px-12 lg:px-24">
      <div className="mx-auto max-w-4xl">
        <motion.div
          className="space-y-8"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={{
            visible: { transition: { staggerChildren: 0.15 } },
            hidden: {},
          }}
        >
          {lines.map((line, i) => (
            <motion.p
              key={i}
              className="font-sans text-2xl font-medium leading-relaxed text-[#fafafa] md:text-3xl lg:text-4xl"
              variants={{
                hidden: { opacity: 0, y: 30 },
                visible: {
                  opacity: 1,
                  y: 0,
                  transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
                },
              }}
            >
              {line}
            </motion.p>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
