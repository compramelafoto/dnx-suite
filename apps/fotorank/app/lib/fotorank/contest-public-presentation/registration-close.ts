import { isSantaFeEnFocoSlug } from "../contest-visual/santa-fe-en-foco";

/**
 * Fuente ÚNICA de la etiqueta pública de cierre de inscripción.
 *
 * Por qué existe: el instante guardado y la fecha publicada no coinciden, y no
 * por error. El cierre se almacena de forma EXCLUSIVA — para Santa Fe en Foco,
 * `2026-10-01T00:00` ART — porque así se calcula si la inscripción sigue
 * abierta: vale mientras `ahora < cierre`, de modo que el 30/09 entero cuenta.
 * Pero lo que se publicó legalmente es el último día hábil INCLUSIVO, o sea
 * "30 de septiembre de 2026".
 *
 * Formatear el instante crudo produce "1 de octubre de 2026" y contradice las
 * Bases. Y restar un día genéricamente sería peor: rompería cualquier concurso
 * cuyo cierre no caiga a medianoche.
 *
 * Antes esta regla vivía hardcodeada dentro de `ContestPublicLanding.tsx`, así
 * que la home —que formatea el valor crudo— mostraba una fecha distinta de la
 * landing para el mismo concurso. Al centralizarla acá, ambas superficies leen
 * la misma etiqueta y la regla legal deja de estar duplicada.
 *
 * Esta función NO decide si la inscripción está abierta: sólo presenta. El
 * instante almacenado y el cálculo de estado quedan intactos.
 */

/** Override de presentación por concurso, cuando lo publicado difiere del instante. */
function overrideLabel(slug: string): string | null {
  /**
   * Santa Fe en Foco 2026: preservado de dcdbda7e (producción, 7 ago). Es
   * contenido legal del concurso, no un comportamiento del sistema public-ui.
   */
  if (isSantaFeEnFocoSlug(slug)) return "30 de septiembre de 2026";
  return null;
}

export function formatPublicDate(date: Date | null | undefined): string | null {
  if (!date) return null;
  try {
    return date.toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return null;
  }
}

export function resolveRegistrationCloseLabel(input: {
  slug: string;
  registrationClosesAt?: Date | null;
  submissionDeadline?: Date | null;
}): string | null {
  const override = overrideLabel(input.slug);
  if (override) return override;
  // Sin override: la fecha de cierre de inscripción manda sobre la de entrega.
  return formatPublicDate(input.registrationClosesAt ?? input.submissionDeadline ?? null);
}
