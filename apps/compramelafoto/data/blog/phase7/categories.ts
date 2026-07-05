import type { Phase7CategoryDef } from "@/data/blog/phase7/types";

/** Categorías nuevas Fase 7. `negocio-fotografico` ya existe en seed-blog. */
export const PHASE7_CATEGORIES: Phase7CategoryDef[] = [
  {
    name: "Tutoriales",
    slug: "guias",
    description:
      "Guías paso a paso para fotógrafos, organizadores, escuelas y clientes. Tutoriales prácticos de ComprameLaFoto.",
    sortOrder: 5,
  },
  {
    name: "Funcionalidades",
    slug: "funcionalidades",
    description:
      "Cómo funciona cada función importante de la plataforma: selfie, eventos, comisiones, preventa y más.",
    sortOrder: 6,
  },
  {
    name: "Comparativas",
    slug: "comparativas",
    description:
      "Comparaciones objetivas entre ComprameLaFoto y otras herramientas del mercado fotográfico.",
    sortOrder: 7,
  },
  {
    name: "Casos de uso",
    slug: "casos-de-uso",
    description:
      "Escenarios reales: maratones, torneos, fiestas de egresados, recitales y eventos corporativos.",
    sortOrder: 8,
  },
];

export const PHASE7_TAGS = [
  "Fotógrafos",
  "Organizadores",
  "Escuelas",
  "Clientes",
  "Referidos",
  "Selfie",
  "Preventa",
  "Comisiones",
  "Marketplace",
  "Impresiones",
  "Digitales",
  "Packs",
  "Álbumes",
  "Eventos colaborativos",
  "Privacidad escolar",
  "Inscripciones",
  "Comparativa",
  "Negocio fotográfico",
] as const;
