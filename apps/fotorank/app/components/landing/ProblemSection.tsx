"use client";

import { motion } from "framer-motion";

export function ProblemSection() {
  return (
    <section id="problema" className="fr-section border-t border-[#1a1a1a]">
      <div className="fr-container-content mx-auto w-full text-center">
        <motion.div
          className="space-y-12"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          variants={{
            visible: { transition: { staggerChildren: 0.12 } },
            hidden: {},
          }}
        >
          <motion.p
            className="fr-body-large text-[#e5e5e5]"
            variants={{
              hidden: { opacity: 0, y: 20 },
              visible: {
                opacity: 1,
                y: 0,
                transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
              },
            }}
          >
            Organizar un concurso fotográfico suele implicar formularios dispersos,
            planillas, seguimiento manual y mucha coordinación.
          </motion.p>
          <motion.p
            className="fr-body-large text-[#a1a1a1]"
            variants={{
              hidden: { opacity: 0, y: 20 },
              visible: {
                opacity: 1,
                y: 0,
                transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
              },
            }}
          >
            FotoRank centraliza ese proceso en una herramienta pensada para que tu
            institución pueda trabajar de forma más ordenada, más clara y con
            mejor presentación.
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
}
