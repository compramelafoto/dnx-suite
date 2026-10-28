import { COMMUNICATIONS_MODULE_KEY } from "@/lib/communications/constants";
import { listModules } from "./registry";

/**
 * Los módulos con los que nace "Tu negocio" (plan Base, diseño del 28/10/2026): todo lo de las
 * familias Base y Negocio fotográfico, para que el fotógrafo use el circuito completo desde el
 * primer día. Los topes por plan son la etapa 2.
 *
 * Quedan afuera:
 * - Comunicación: sus placas son la bienvenida y el socio de la semana, que necesitan un padrón.
 * - Los que cobran comisión (Digitalización): no se encienden solos, se pide la activación,
 *   igual que en la pantalla de Módulos (`paqueteSugerido`).
 * - Los institucionales: en un negocio confunden.
 */
const EXCLUIDOS: ReadonlySet<string> = new Set([COMMUNICATIONS_MODULE_KEY]);

export function modulosInicialesDeNegocio(): string[] {
  return listModules({ status: "AVAILABLE" })
    .filter((m) => (m.family === "base" || m.family === "negocio") && !m.platformFee && !EXCLUIDOS.has(m.key))
    .map((m) => m.key);
}
