import { resolveConsentimientoConfig } from "../split-1n-consentimiento/config";
import { resolvePilotoConfig } from "../split-1n-piloto/config";

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
 * ¿Está encendido todo lo necesario para que el cobro dividido corra y se pueda pedir la
 * invitación? Piloto en todos los álbumes, consentimiento, el freno del adaptador de pagos,
 * el token y la cuenta de la plataforma. Sin eso, pedir el anexo dejaría gente trabada.
 */
function cobroDivididoListo(env: NodeJS.ProcessEnv): boolean {
  const piloto = resolvePilotoConfig(env);
  return (
    piloto.enabled &&
    piloto.todosLosAlbumes &&
    piloto.accessToken != null &&
    piloto.ownerUserId != null &&
    resolveConsentimientoConfig(env).enabled &&
    env.DNX_MP_SPLIT_CONSENT_PRODUCTION_ENABLED?.trim().toLowerCase() === "true"
  );
}

/**
 * Cartel obligatorio del cobro dividido. Se enciende sólo con el cobro dividido listo y una
 * fecha límite válida: un error de configuración nunca bloquea el panel. Para apagarlo de
 * urgencia alcanza con borrar la fecha.
 */
export function resolveAceptacionConfig(env: NodeJS.ProcessEnv = process.env): AceptacionConfig {
  const limite = medianocheArgentina(env[ACEPTACION_LIMITE_FLAG]);
  if (!limite || !cobroDivididoListo(env)) return { enabled: false, limite: null };
  return { enabled: true, limite };
}
