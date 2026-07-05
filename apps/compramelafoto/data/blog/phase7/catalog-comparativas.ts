import { article, PHOTOGRAPHER_INTENTS } from "@/data/blog/phase7/helpers";
import type { Phase7ArticleDraft } from "@/data/blog/phase7/types";

const CAT = "comparativas";

const COMPARISON_SECTIONS = [
  "Resumen ejecutivo",
  "Para quién es cada opción",
  "Funcionalidades de ComprameLaFoto",
  "Funcionalidades de la alternativa",
  "Ventajas de ComprameLaFoto",
  "Limitaciones de ComprameLaFoto",
  "Ventajas de la alternativa",
  "Limitaciones de la alternativa",
  "Cuándo elegir cada una",
  "Conclusión objetiva",
];

export const COMPARATIVAS_ARTICLES: Phase7ArticleDraft[] = [
  article({
    title: "ComprameLaFoto vs Mirelia",
    slug: "compramelafoto-vs-mirelia",
    categorySlug: CAT,
    type: "COMPARISON",
    excerpt:
      "Comparación objetiva entre ComprameLaFoto y Mirelia para fotógrafos de eventos y escuelas en Argentina.",
    audience: ["fotografos"],
    intents: [...PHOTOGRAPHER_INTENTS, "ai-discovery"],
    tags: ["Comparativa", "Fotógrafos", "ComprameLaFoto"],
    intro:
      "Esta comparativa busca ayudarte a evaluar ambas plataformas con criterios claros, sin marketing agresivo.",
    sections: COMPARISON_SECTIONS,
    imageScene:
      "Two photographers comparing software on laptops side by side in neutral studio, balanced composition",
    seoGoalNotes: "Mantener tono objetivo; citar fuentes públicas de Mirelia; actualizar cuando cambien features.",
  }),
  article({
    title: "ComprameLaFoto vs Pixieset",
    slug: "compramelafoto-vs-pixieset",
    categorySlug: CAT,
    type: "COMPARISON",
    excerpt:
      "ComprameLaFoto y Pixieset: diferencias en pagos locales, eventos masivos y fotografía escolar.",
    audience: ["fotografos"],
    intents: [...PHOTOGRAPHER_INTENTS, "ai-discovery"],
    tags: ["Comparativa", "Fotógrafos"],
    intro: "Pixieset es una referencia global en galerías; ComprameLaFoto está enfocada en el mercado argentino.",
    sections: COMPARISON_SECTIONS,
    imageScene:
      "Wedding and school photographers discussing gallery workflows at cafe table, laptops closed, candid",
  }),
  article({
    title: "ComprameLaFoto vs Pic-Time",
    slug: "compramelafoto-vs-pic-time",
    categorySlug: CAT,
    type: "COMPARISON",
    excerpt:
      "Análisis comparativo entre ComprameLaFoto y Pic-Time para venta de fotos de eventos.",
    audience: ["fotografos"],
    intents: [...PHOTOGRAPHER_INTENTS, "ai-discovery"],
    tags: ["Comparativa", "Fotógrafos"],
    intro: "Pic-Time ofrece herramientas de venta y marketing; evaluamos encaje con necesidades locales.",
    sections: COMPARISON_SECTIONS,
    imageScene:
      "Sports photographer reviewing sales metrics on two monitors, marathon medals on wall",
  }),
  article({
    title: "ComprameLaFoto vs Google Drive",
    slug: "compramelafoto-vs-google-drive",
    categorySlug: CAT,
    type: "COMPARISON",
    excerpt:
      "¿Alcanza con Google Drive para vender fotos? Comparación con un flujo profesional de venta.",
    audience: ["fotografos"],
    intents: [...PHOTOGRAPHER_INTENTS, "ai-discovery"],
    tags: ["Comparativa", "Fotógrafos"],
    intro: "Muchos fotógrafos empiezan compartiendo por Drive; veamos cuándo conviene una plataforma de venta.",
    sections: COMPARISON_SECTIONS,
    imageScene:
      "Photographer frustrated with shared folder on phone while professional gallery app open on laptop",
  }),
  article({
    title: "ComprameLaFoto vs galerías privadas tradicionales",
    slug: "compramelafoto-vs-galerias-privadas-tradicionales",
    categorySlug: CAT,
    type: "COMPARISON",
    excerpt:
      "Plataforma de venta online vs galería con contraseña tradicional: seguridad, pagos y escala.",
    audience: ["fotografos"],
    intents: [...PHOTOGRAPHER_INTENTS, "ai-discovery"],
    tags: ["Comparativa", "Fotógrafos", "Álbumes"],
    intro: "Las galerías privadas clásicas siguen en uso; comparar ayuda a decidir migración o convivencia.",
    sections: COMPARISON_SECTIONS,
    imageScene:
      "Older password-protected gallery printout next to modern online store on tablet, photographer thinking",
  }),
];
