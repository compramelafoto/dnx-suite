"use client";

import { motion } from "framer-motion";
import { SectionTitle } from "./SectionTitle";

const steps = [
  {
    number: "01",
    title: "Creá tu convocatoria",
    description:
      "Publicá tu concurso con toda la información necesaria. Bases, fechas y requisitos en un solo lugar.",
  },
  {
    number: "02",
    title: "Definí categorías, bases y fechas",
    description:
      "Configurá las categorías de participación, plazos de inscripción y criterios de evaluación.",
  },
  {
    number: "03",
    title: "Recibí y ordená inscripciones",
    description:
      "Las participaciones llegan organizadas. Sin planillas sueltas ni correos perdidos.",
  },
  {
    number: "04",
    title: "Gestioná evaluación y resultados",
    description:
      "Asigná jurados, seguí el proceso de evaluación y presentá los resultados de forma clara y profesional.",
  },
];

export function HowItWorksSection() {
  return (
    <section id="como-funciona" className="fr-section border-t border-[#1a1a1a]">
      <div className="fr-container mx-auto w-full">
        <SectionTitle
          title="¿Cómo funciona?"
          className="mb-40 text-center md:mb-64"
        />

        <div className="grid gap-10 md:grid-cols-2 md:gap-12">
          {steps.map((step, i) => (
            <motion.div
              key={step.number}
              className="fr-card"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{
                duration: 0.45,
                delay: i * 0.06,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <span className="fr-eyebrow">{step.number}</span>
              <h3 className="mt-8 fr-title-card text-[#fafafa]">{step.title}</h3>
              <p className="mt-5 fr-body-small leading-relaxed text-[#a1a1a1]">{step.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
