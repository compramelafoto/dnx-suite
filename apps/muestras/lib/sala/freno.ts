import { frenarPorIp, frenarPorPase } from "@/lib/limite";
import type { PaseDeSala } from "./consultas";

/** Lo que ve quien llega al tope de la red: nunca una redirección muda (spec D30). */
export const MUCHA_GENTE_EN_LA_RED = "Hay mucha gente consultando desde esta red. Probá en un minuto.";
/** Lo que ve quien llega al tope de su pase. */
export const MUCHAS_CONSULTAS = "Hiciste muchas consultas seguidas. Probá en un minuto.";

/**
 * El freno de la vista de sala (o de sus imágenes) después de leer el pase: por pase (la huella de
 * la cookie, ya validada), así el público que comparte el Wi-Fi de la sala no se frena entre sí. El
 * equipo, o quien no tiene pase, por IP (quien no tiene pase igual termina en la página pública).
 */
export function frenarEnSala(que: "vistaSala" | "imagenSala", p: PaseDeSala | null, ip: string): boolean {
  if (p?.pase && p.huella) return frenarPorPase(que, p.huella).allowed;
  return frenarPorIp(que, ip).allowed;
}
