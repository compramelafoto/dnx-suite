import { foldQuoteText } from "./fold.js";
import type { PhotographyServiceType } from "./models.js";

type ServiceRule = {
  type: PhotographyServiceType;
  patterns: RegExp[];
};

/**
 * Orden de prioridad: más específico primero.
 * FIFTEENTH_BIRTHDAY antes que BIRTHDAY; categorías concretas antes que SOCIAL/OTHER.
 */
const SERVICE_RULES: readonly ServiceRule[] = [
  {
    type: "FIFTEENTH_BIRTHDAY",
    patterns: [
      /\bcumpleanos\s+de\s+15\b/,
      /\bfiesta\s+de\s+15\b/,
      /\bfiesta\s+de\s+quince(\s+anos)?\b/,
      /\bquince\s+anos\b/,
      /\bquinceanera\b/,
      /\bsesion\s+(de\s+)?quince\b/,
      /\b15\s+anos\b/,
      /\bcumpleanos\s+de\s+quince\b/,
    ],
  },
  {
    type: "WEDDING",
    patterns: [
      /\b(casamiento|boda|casamientos|bodas)\b/,
      /\bme caso\b/,
      /\bcivil\b/,
      /\bceremonia\s+y\s+fiesta\b/,
      /\bcobertura\s+de\s+casamiento\b/,
    ],
  },
  {
    type: "CORPORATE_EVENT",
    patterns: [
      /\bevento\s+(empresarial|corporativo)\b/,
      /\b(conferencia|congreso)\b/,
      /\bjornada\s+empresarial\b/,
      /\blanzamiento\s+de\s+producto\b/,
      /\bcorporativo\b/,
    ],
  },
  {
    type: "SCHOOL_PHOTOGRAPHY",
    patterns: [
      /\bfotografi?a\s+escolar\b/,
      /\bfotos?\s+escolares?\b/,
      /\bacto\s+escolar\b/,
      /\begresados?\b/,
      /\bcurso\s+escolar\b/,
    ],
  },
  {
    type: "SPORTS_EVENT",
    patterns: [
      /\bpartido(\s+de\s+futbol)?\b/,
      /\btorneo\b/,
      /\bevento\s+deportivo\b/,
      /\bcompetencia\s+deportiva\b/,
      /\bcarrera(\s+deportiva)?\b/,
      /\bmaraton\s+deportiva\b/,
    ],
  },
  {
    type: "PRODUCT_PHOTOGRAPHY",
    patterns: [
      /\bfotos?\s+de\s+producto\b/,
      /\bfotografi?a\s+de\s+producto\b/,
      /\bcatalogo\b/,
      /\be-?commerce\b/,
      /\bfotos?\s+para\s+tienda\b/,
    ],
  },
  {
    type: "FAMILY_SESSION",
    patterns: [
      /\bsesion\s+familiar\b/,
      /\bfotos?\s+(de\s+)?familia\b/,
      /\bsesion\s+con\s+mis\s+hijos\b/,
      /\bfotos?\s+familiares\b/,
    ],
  },
  {
    type: "PORTRAIT_SESSION",
    patterns: [
      /\bsesion\s+de\s+retrato\b/,
      /\bfotos?\s+personales\b/,
      /\bbook\b/,
      /\bsesion\s+individual\b/,
      /\bfotos?\s+profesionales\s+personales\b/,
      /\bretrato\b/,
    ],
  },
  {
    type: "BIRTHDAY",
    patterns: [
      /\bcumpleanos\b/,
      /\bfiesta\s+de\s+cumpleanos\b/,
      /\bcumple\s+infantil\b/,
      /\bcumpleanos\s+de\s+adulto\b/,
      /\bcumple\b/,
    ],
  },
  {
    type: "SOCIAL_EVENT",
    patterns: [
      /\baniversario\b/,
      /\bbautismo\b/,
      /\bcomunion\b/,
      /\bevento\s+social\b/,
      /\bcelebracion\b/,
      /\bfiesta\b/,
    ],
  },
  {
    type: "OTHER",
    patterns: [
      /\b(cobertura|sesion|fotograf(ia|o|a)|fotos?)\b.*\b(proyecto|artistico|especial|experimental|mascota|perro|gato)\b/,
      /\bpresupuesto\b.*\b(fotos?|fotograf)/,
    ],
  },
];

/**
 * Extrae tipo de servicio. No inventa: si no hay evidencia, retorna undefined
 * (el campo queda ausente / UNKNOWN solo si se fuerza en capas superiores).
 */
export function extractServiceType(normalizedText: string): PhotographyServiceType | undefined {
  const folded = foldQuoteText(normalizedText);
  if (!folded) return undefined;

  // Evitar "15 personas" como quinceañera
  const fifteenthSafe = folded.replace(/\b15\s+personas?\b/g, " ");

  for (const rule of SERVICE_RULES) {
    const haystack = rule.type === "FIFTEENTH_BIRTHDAY" ? fifteenthSafe : folded;
    for (const pattern of rule.patterns) {
      if (pattern.test(haystack)) {
        // OTHER solo si no hubo categoría más específica (ya iteramos en orden)
        if (rule.type === "OTHER") {
          // Requiere señal fotográfica + no match previo (ya garantizado)
          return "OTHER";
        }
        return rule.type;
      }
    }
  }

  return undefined;
}
