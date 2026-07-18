import type { VisualNiche, VisualReferenceIntent } from "./visual-reference-intent.js";

const REQUEST_RE =
  /\b(mostrame|mostrar|ver fotos|ejemplos? de fotos|referencias? visuales?|ideas para fotograf|qu[eé] tipo de fotos|galer[ií]a)\b/i;

const NICHE_PATTERNS: Array<{ niche: VisualNiche; re: RegExp }> = [
  { niche: "bodas", re: /\b(bodas?|casamientos?|weddings?)\b/i },
  { niche: "cumpleaños de quince", re: /\b(quince|15.?a[nñ]os|cumplea[nñ]os de quince)\b/i },
  { niche: "fotografía deportiva", re: /\b(deportes?|deportiv\w*|running|carreras?|f[uú]tbol)\b/i },
  { niche: "fotografía escolar", re: /\b(escolares?|colegios?|escuelas?)\b/i },
  { niche: "recitales", re: /\b(recitales?|conciertos?|bandas?)\b/i },
  { niche: "retratos", re: /\b(retratos?|book)\b/i },
  { niche: "familia", re: /\b(familiares?|familias?)\b/i },
  { niche: "producto", re: /\b(productos?|cat[aá]logos?)\b/i },
  { niche: "gastronomía", re: /\b(gastronom\w*|comida|restaurants?)\b/i },
  { niche: "inmobiliaria", re: /\b(inmobiliari\w*|propiedades?|departamentos?)\b/i },
  { niche: "corporativa", re: /\b(corporativ\w*|empresas?|oficinas?)\b/i },
  { niche: "eventos sociales", re: /\b(evento social|fiestas?|cumplea[nñ]os)\b/i },
];

/**
 * Diagnóstico puro — no busca ni muestra fotos.
 */
export function detectVisualReferenceIntent(message: string): VisualReferenceIntent {
  const requested = REQUEST_RE.test(message);
  if (!requested) {
    return { requested: false, confidence: 0, sourceMessage: message };
  }

  let niche: VisualNiche | undefined;
  for (const entry of NICHE_PATTERNS) {
    if (entry.re.test(message)) {
      niche = entry.niche;
      break;
    }
  }

  return {
    requested: true,
    niche,
    confidence: niche ? 0.85 : 0.6,
    sourceMessage: message,
  };
}
