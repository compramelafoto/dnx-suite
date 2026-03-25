"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "./Button";

export function HeroSection() {
  return (
    <section className="fr-section relative flex flex-col items-center justify-center !pt-12 pb-20 text-center md:!pt-16 md:pb-24">
      <div className="fr-hero-glow pointer-events-none absolute inset-0" aria-hidden />

      <div className="fr-container-narrow relative flex w-full flex-col items-center gap-y-8 text-center md:gap-y-10">
        <motion.h1
          className="w-full font-sans text-3xl font-semibold tracking-tight text-[#fafafa] leading-[1.05] md:text-4xl lg:text-5xl xl:text-6xl"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
        >
          Organizá concursos fotográficos sin desorden ni procesos manuales
        </motion.h1>

        <motion.p
          className="w-full max-w-[36rem] text-center fr-body-large text-[#a1a1a1] leading-[1.25]"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.35 }}
        >
          FotoRank ayuda a instituciones, comunidades y organizadores a crear
          convocatorias, gestionar categorías, ordenar inscripciones y presentar
          resultados de forma simple y profesional.
        </motion.p>

        <motion.div
          className="flex flex-wrap items-center justify-center gap-6"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          <Button href="/dashboard" variant="primary">
            Crear concurso
          </Button>
          <Link
            href="/#como-funciona"
            className="fr-btn fr-btn-secondary inline-flex"
          >
            <svg className="size-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path d="M8 5v14l11-7z" />
            </svg>
            Ver cómo funciona
          </Link>
        </motion.div>

        <motion.a
          href="/#problema"
          className="absolute bottom-8 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 text-[#404040] transition-colors hover:text-[#525252]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.4 }}
          aria-label="Desplazar hacia abajo"
        >
          <motion.svg
            className="size-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            animate={{ y: [0, 3, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </motion.svg>
        </motion.a>
      </div>
    </section>
  );
}
