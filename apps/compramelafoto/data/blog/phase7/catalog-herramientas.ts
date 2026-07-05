import { article, PHOTOGRAPHER_INTENTS } from "@/data/blog/phase7/helpers";
import type { Phase7ArticleDraft } from "@/data/blog/phase7/types";

const CAT = "herramientas-para-fotografos";

export const HERRAMIENTAS_ARTICLES: Phase7ArticleDraft[] = [
  article({
    title:
      "¿Cuánto cobrar por un trabajo de fotografía? La guía definitiva para calcular tus presupuestos profesionales",
    slug: "cuanto-cobrar-fotografia",
    categorySlug: CAT,
    excerpt:
      "Aprendé a calcular cuánto cobrar por una sesión de fotos o un evento con un método basado en costos reales, horas de trabajo y objetivos de rentabilidad — sin adivinar precios.",
    seoDescription:
      "Aprendé cómo calcular cuánto cobrar por una sesión de fotos o un evento utilizando una calculadora profesional basada en costos reales.",
    audience: ["fotografos"],
    intents: PHOTOGRAPHER_INTENTS,
    tags: [
      "Negocio fotográfico",
      "Fotógrafos",
      "Presupuestos",
      "Cuánto Cobro",
      "Marketing",
    ],
    intro:
      "Fijar precios en fotografía no debería ser un ejercicio de intuición ni de copiar lo que cobra el colega de al lado. Un presupuesto profesional parte de tus costos, tu tiempo y el margen que necesitás para sostener tu actividad.",
    sections: [
      "Por qué adivinar precios te hace perder dinero",
      "Los tres errores más comunes al presupuestar",
      "Qué debe incluir un presupuesto fotográfico profesional",
      "Cómo calcular tu tarifa por hora real",
      "Costos fijos, variables y renovación de equipos",
      "Cuánto cobrar según el tipo de trabajo",
      "Margen, impuestos y objetivo de ganancia",
      "Cómo presentar el presupuesto al cliente",
      "Preguntas frecuentes",
    ],
    imageScene:
      "Professional photographer reviewing pricing spreadsheet on laptop with camera gear on desk, soft window light, trustworthy editorial workspace",
    imageAltSubject: "Calculadora de presupuestos para fotógrafos - Cuánto Cobro",
    seoGoalNotes:
      "Artículo pilar SEO para captar fotógrafos interesados en calcular presupuestos con la herramienta ¿Cuánto Cobro?",
  }),
];
