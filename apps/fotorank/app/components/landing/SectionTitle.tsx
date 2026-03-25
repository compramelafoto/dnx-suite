"use client";

import { motion } from "framer-motion";

interface SectionTitleProps {
  label?: string;
  title: string;
  className?: string;
}

export function SectionTitle({ label, title, className = "" }: SectionTitleProps) {
  return (
    <motion.div
      className={`fr-title-to-content space-y-4 ${className}`}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      {label && (
        <p className="fr-eyebrow">{label}</p>
      )}
      <h2 className="font-sans text-3xl font-semibold leading-[1.2] tracking-tight text-[#fafafa] md:text-4xl lg:text-5xl">{title}</h2>
    </motion.div>
  );
}
