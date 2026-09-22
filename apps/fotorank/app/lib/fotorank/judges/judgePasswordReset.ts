/**
 * "Olvidé mi contraseña" para un jurado.
 *
 * Hacía falta porque la cuenta de jurado (`FotorankJudgeAccount`) es una
 * identidad aparte de `User`, y `/recuperar` —el reset del sitio— busca en
 * `User`. Un jurado que pedía recuperar su clave ahí recibía el mensaje
 * neutro de siempre y **nunca le llegaba nada**: peor que un error, porque
 * parecía que había funcionado.
 *
 * Usa `EmailVerificationToken` con `purpose = PASSWORD_RESET`, el mismo
 * mecanismo que la confirmación de correo. El propósito es nuevo a propósito:
 * reutilizar `VERIFY_EMAIL` haría que el enlace de confirmar un correo sirva
 * también para cambiarle la contraseña a esa cuenta.
 */

import { cuentaDeJuradoAbreElPanel } from "../access/judge-panel-entry";
import { PASSWORD_MINIMA } from "./publicSignupForm";

/**
 * Dos horas, no 48 como la confirmación de correo.
 *
 * Un enlace que cambia una contraseña es una llave: cuanto menos tiempo viva,
 * menos ventana hay si el correo queda abierto en una pantalla ajena. La
 * confirmación puede esperar dos días porque no abre nada.
 */
export const RESET_VIGENCIA_HORAS = 2;

export type ErroresDeNuevaClave = {
  password?: string;
  passwordConfirm?: string;
};

/**
 * Valida la contraseña nueva y su repetición.
 *
 * Pide repetirla porque quien la escribe no la ve y, si se equivoca, queda
 * afuera de la única puerta que acaba de arreglar.
 */
export function revisarNuevaClave(input: {
  password: string;
  passwordConfirm: string;
}): { ok: true } | { ok: false; errores: ErroresDeNuevaClave } {
  const errores: ErroresDeNuevaClave = {};

  if (!input.password) {
    errores.password = "Escribí una contraseña nueva.";
  } else if (input.password.length < PASSWORD_MINIMA) {
    errores.password = `La contraseña necesita al menos ${PASSWORD_MINIMA} caracteres.`;
  }

  if (!errores.password && input.password !== input.passwordConfirm) {
    errores.passwordConfirm = "Las dos contraseñas no coinciden.";
  }

  if (Object.keys(errores).length > 0) return { ok: false, errores };
  return { ok: true };
}

/**
 * Qué se le responde a quien pide el enlace.
 *
 * Siempre lo mismo, exista o no la cuenta. Si dijera "no encontramos ese
 * correo", cualquiera podría averiguar quién es jurado en la plataforma
 * probando direcciones. El sitio ya responde así en `/recuperar`.
 */
export const RESPUESTA_NEUTRA =
  "Si ese correo tiene una cuenta de jurado, te mandamos un enlace para cambiar la contraseña. Revisá tu casilla, y también el correo no deseado.";

/** Qué hacer cuando el enlace venció o ya se usó. */
export const COMO_PEDIR_OTRO = "Pedí uno nuevo desde la pantalla de acceso.";

export type EstadoDeCuentaParaReset = {
  accountStatus: string;
};

/**
 * ¿A esta cuenta se le puede mandar el enlace?
 *
 * Es la misma regla que decide si la persona ve el panel de jurado, y se
 * reutiliza en vez de reescribirla: si una cuenta suspendida no puede entrar,
 * recuperar la contraseña tampoco puede ser la puerta de atrás.
 *
 * La respuesta que ve la persona no cambia: es neutra igual.
 */
export function puedeRecibirEnlaceDeReset(cuenta: EstadoDeCuentaParaReset | null): boolean {
  return cuentaDeJuradoAbreElPanel(cuenta?.accountStatus);
}
