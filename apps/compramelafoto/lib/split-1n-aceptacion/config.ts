import { resolveConsentimientoConfig } from "../split-1n-consentimiento/config";

/** Fecha límite (AAAA-MM-DD, hora argentina) desde la que el cartel ya no se puede posponer. */
export const ACEPTACION_LIMITE_FLAG = "DNX_CLF_SPLIT_1N_ACEPTACION_LIMITE";

export type AceptacionConfig = { enabled: boolean; limite: Date | null };

/** Medianoche del día indicado en Argentina (UTC−3, sin horario de verano), o null si no es válido. */
function medianocheArgentina(valor: string | undefined): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor?.trim() ?? "");
  if (!m) return null;
  const [anio, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const fecha = new Date(Date.UTC(anio, mes - 1, dia, 3, 0, 0));
  const ok =
    fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia;
  return ok ? fecha : null;
}

/**
 * Cartel obligatorio del cobro dividido. Se enciende sólo con el consentimiento encendido y una
 * fecha límite válida: un error de configuración nunca bloquea el panel.
 */
export function resolveAceptacionConfig(env: NodeJS.ProcessEnv = process.env): AceptacionConfig {
  const limite = medianocheArgentina(env[ACEPTACION_LIMITE_FLAG]);
  if (!resolveConsentimientoConfig(env).enabled || !limite) return { enabled: false, limite: null };
  return { enabled: true, limite };
}
