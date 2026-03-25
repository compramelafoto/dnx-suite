"use client";

import { motion } from "framer-motion";
import { Button } from "./Button";

export function FinalCTASection() {
  return (
    <section className="fr-section border-t border-[#1a1a1a]">
      <motion.div
        className="fr-container-narrow mx-auto w-full rounded-lg border border-[#262626] bg-[#141414] px-10 py-16 text-center sm:px-16 sm:py-20 md:px-24 md:py-28 lg:px-32 lg:py-36"
        initial={{ opacity: 0, y: 32 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="flex flex-col items-center gap-8 md:gap-10 lg:gap-12">
          <h2 className="font-sans text-2xl font-semibold leading-[1.2] tracking-tight text-[#fafafa] md:text-3xl lg:text-4xl">
            Empezá a organizar tu concurso con una herramienta pensada para eso
          </h2>
          <p className="max-w-[32rem] fr-body-large text-[#a1a1a1] leading-relaxed">
            Si tu institución, comunidad o proyecto necesita una forma más simple de
            gestionar convocatorias fotográficas, FotoRank te ayuda a ordenarlo
            desde el inicio.
          </p>
          <div className="flex flex-wrap justify-center gap-6 md:gap-8">
          <Button href="/dashboard" variant="primary">
            Crear concurso
          </Button>
          <Button href="/#como-funciona" variant="secondary">
            Ver cómo funciona
          </Button>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
