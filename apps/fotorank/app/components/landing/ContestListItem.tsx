"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { routes } from "../../lib/routes";

export interface ContestItem {
  slug: string;
  number?: string;
  name: string;
  category: string;
  status: "Inscripciones abiertas" | "Próximamente" | "Cerrado";
  organizerName?: string;
  deadlineLabel?: string;
  ctaLabel?: string;
}

interface ContestListItemProps {
  contest: ContestItem;
  index: number;
}

export function ContestListItem({ contest, index }: ContestListItemProps) {
  const statusColors = {
    "Inscripciones abiertas": "text-[#D4AF37]",
    Próximamente: "text-[#a1a1a1]",
    Cerrado: "text-[#737373]",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-24px" }}
      transition={{
        duration: 0.4,
        delay: index * 0.06,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      <Link
        href={routes.concursos.publico(contest.slug)}
        className="group flex flex-col gap-4 border-b border-[#1a1a1a] py-8 transition-colors hover:border-[#262626] sm:flex-row sm:items-center sm:justify-between md:py-10"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-10 md:gap-14">
          {contest.number ? (
            <span className="font-sans text-2xl font-medium text-[#404040] transition-colors group-hover:text-[#D4AF37] md:text-3xl">
              {contest.number}
            </span>
          ) : null}
          <div>
            <h3 className="font-sans text-xl font-semibold leading-[1.2] text-[#fafafa] transition-colors group-hover:text-[#D4AF37] md:text-2xl">
              {contest.name}
            </h3>
            <p className="mt-1 fr-body-small text-[#a1a1a1]">{contest.category}</p>
            {contest.organizerName ? (
              <p className="mt-1 text-xs text-[#8a8a8a]">Organiza: {contest.organizerName}</p>
            ) : null}
            {contest.deadlineLabel ? (
              <p className="mt-1 text-xs text-[#8a8a8a]">{contest.deadlineLabel}</p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-col items-start gap-1 sm:items-end">
          <span className={`fr-body-small font-medium ${statusColors[contest.status]}`}>{contest.status}</span>
          <span className="text-xs text-[#d4af37]">{contest.ctaLabel ?? "Ver concurso"}</span>
        </div>
      </Link>
    </motion.div>
  );
}
