import { decidirEnvio } from "./rate-limit";
import type { CoverageSettingsShape } from "./settings";

/**
 * Qué hacer con un envío, decidido antes de escribir nada.
 *
 * Vive aparte de la transacción porque acá están las decisiones que importan y todas se pueden
 * probar sin base de datos. El orden de las comprobaciones no es casual y está probado: el
 * freno va ANTES del duplicado, porque al revés quien manda cien pedidos iguales recibiría
 * cien respuestas amables en vez de un freno.
 */
export type SubmissionPlan =
  | { kind: "GUARDAR" }
  | { kind: "YA_EXISTE"; requestId: string; publicCode: string }
  | { kind: "RECHAZAR"; error: string };

export function planSubmission(input: {
  settings: CoverageSettingsShape;
  recientes: number;
  duplicada: { id: string; publicCode: string } | null;
  parsed: { contactEmail: string; startsAt: Date };
}): SubmissionPlan {
  // Esconder el formulario no es un control: el POST puede llegar igual, de un formulario
  // viejo abierto en otra pestaña o armado a mano.
  if (!input.settings.publicFormEnabled) {
    return { kind: "RECHAZAR", error: "Las solicitudes no están abiertas en este momento." };
  }

  const freno = decidirEnvio({ recientes: input.recientes });
  if (!freno.ok) return { kind: "RECHAZAR", error: freno.error };

  if (input.duplicada) {
    return {
      kind: "YA_EXISTE",
      requestId: input.duplicada.id,
      publicCode: input.duplicada.publicCode,
    };
  }

  return { kind: "GUARDAR" };
}
