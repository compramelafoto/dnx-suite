"use server";

import { responderPorToken, type ResultadoResponder } from "@/lib/cuestionarios/cuestionarios-servidor";

/**
 * El cliente manda sus respuestas desde el enlace, sin cuenta: el token es la credencial.
 * La validación (ids conocidos, largos, fechas) y el tope de tamaño están en `responderPorToken`.
 */
export async function enviarRespuestasAction(token: string, valores: unknown): Promise<ResultadoResponder> {
  if (typeof token !== "string") return { ok: false, error: "Este enlace ya no está disponible." };
  return responderPorToken(token, valores);
}
