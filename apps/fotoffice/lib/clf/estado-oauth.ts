import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * El `state` del ida y vuelta con CLF (conexión, etapa 2). Módulo puro. Se guarda en una cookie httpOnly como
 * `<state>.<workspaceId>`; al volver, el `state` tiene que coincidir y el workspace tiene que ser el de la sesión.
 */

export const COOKIE_ESTADO_CLF = "fo_clf_state";
export const VIDA_ESTADO_CLF_S = 10 * 60;

export function nuevoEstado(): string {
  return randomBytes(32).toString("base64url");
}

export function valorDeCookie(state: string, workspaceId: string): string {
  return `${state}.${workspaceId}`;
}

function igual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

/** ¿El `state` que volvió de CLF corresponde a la cookie y al workspace de la sesión? */
export function estadoValido(cookie: string | undefined, state: string | null, workspaceId: string): boolean {
  if (!cookie || !state) return false;
  const i = cookie.lastIndexOf(".");
  if (i <= 0) return false;
  const guardado = cookie.slice(0, i);
  const ws = cookie.slice(i + 1);
  return igual(guardado, state) && ws === workspaceId;
}
