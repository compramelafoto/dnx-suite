/**
 * Entrar al panel de jurado con la contraseña del sitio.
 *
 * Una persona no puede tener dos contraseñas en la misma plataforma. Pasaba
 * porque la cuenta de jurado (`FotorankJudgeAccount`) es una identidad aparte
 * de `User`, cada una con su clave, su sesión y su formulario: alguien
 * cambiaba su contraseña en `/recuperar`, entraba bien a FotoRank, y al tocar
 * "Panel de jurado" le pedían otra que no había cambiado y no recordaba.
 *
 * Este puente hace que la sesión del sitio abra también el panel de jurado,
 * sin pedir nada. La contraseña de jurado deja de usarse en la práctica;
 * `/jurado/login` queda como puerta de respaldo.
 *
 * **Las dos puntas tienen que estar confirmadas.** El registro del sitio abre
 * sesión sin esperar a que confirmen el correo, así que alguien podría
 * anotarse con una dirección ajena y quedar con sesión activa. Si el puente
 * mirara sólo la sesión, esa persona entraría al panel de jurado del dueño
 * real del correo. Por eso se exigen las dos confirmaciones: la del sitio
 * prueba que quien está sentado controla ese buzón, y la del jurado, que la
 * ficha es suya.
 */

export type UsuarioDelSitio = {
  email: string;
  emailVerifiedAt: Date | null;
};

export type CuentaDeJuradoParaPuente = {
  accountStatus: string;
  emailVerifiedAt: Date | null;
};

export type RazonSinPuente =
  | "SIN_SESION_DE_SITIO"
  | "SIN_CUENTA_DE_JURADO"
  | "CUENTA_NO_ACTIVA"
  | "FALTA_CONFIRMAR_EL_CORREO_DEL_SITIO";

export type ResultadoDelPuente =
  | { ok: true }
  | { ok: false; razon: RazonSinPuente };

export function puedeEntrarConLaSesionDelSitio(input: {
  usuario: UsuarioDelSitio | null;
  cuentaDeJurado: CuentaDeJuradoParaPuente | null;
}): ResultadoDelPuente {
  if (!input.usuario) return { ok: false, razon: "SIN_SESION_DE_SITIO" };
  if (!input.cuentaDeJurado) return { ok: false, razon: "SIN_CUENTA_DE_JURADO" };

  /*
   * Sólo ACTIVE, no INVITED.
   *
   * Es más estricto que la regla del atajo en el menú, y a propósito: mostrar
   * una entrada de más no le abre la puerta a nadie, entrar sin contraseña sí.
   * Una cuenta invitada todavía no terminó de darse de alta.
   */
  if (input.cuentaDeJurado.accountStatus !== "ACTIVE") {
    return { ok: false, razon: "CUENTA_NO_ACTIVA" };
  }

  if (!input.usuario.emailVerifiedAt) {
    return { ok: false, razon: "FALTA_CONFIRMAR_EL_CORREO_DEL_SITIO" };
  }

  return { ok: true };
}

/**
 * El único caso que se le cuenta a la persona.
 *
 * Los otros tres no son problemas suyos: sin sesión del sitio ve el login de
 * siempre, y sin cuenta de jurado o con la cuenta dada de baja no tiene nada
 * que ver en ese panel. Este, en cambio, lo resuelve ella en un minuto.
 */
export const FALTA_CONFIRMAR_EL_CORREO =
  "Para entrar a tu panel de jurado con la misma contraseña del sitio, confirmá tu correo. Te mandamos el enlace y no tenés que acordarte de ninguna otra clave.";
