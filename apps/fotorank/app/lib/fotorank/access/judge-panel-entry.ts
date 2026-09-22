/**
 * Quién ve la entrada "Panel de jurado" en el menú lateral.
 *
 * Una misma persona puede ser organizadora, participante y jurado a la vez.
 * Su cuenta de jurado (`FotorankJudgeAccount`) es una identidad aparte de su
 * `User`: lo único que las une es el correo. Por eso la pregunta "¿además sos
 * jurado?" se responde por correo y no por id.
 *
 * El criterio de "cuenta utilizable" vive acá y lo consume también
 * `home-capabilities.ts`, para que el hub personal y los paneles no puedan
 * divergir: si un panel muestra la entrada, todos la muestran.
 */

/** Estados en los que la persona ya puede entrar al panel de jurado. */
const ESTADOS_QUE_ABREN_EL_PANEL = new Set(["ACTIVE", "INVITED"]);

/**
 * `INVITED` cuenta a propósito: la invitación es lo que estrena la cuenta, y
 * sin la entrada en el menú no tendría por dónde llegar a aceptarla.
 * Suspendida o dada de baja, la entrada desaparece.
 */
export function cuentaDeJuradoAbreElPanel(accountStatus: string | null | undefined): boolean {
  if (!accountStatus) return false;
  return ESTADOS_QUE_ABREN_EL_PANEL.has(accountStatus);
}

/** Rótulo único de la entrada. Está acá para que no se escriba distinto en cada menú. */
export const PANEL_DE_JURADO_ETIQUETA = "Panel de jurado";

/**
 * El destino es el panel, no el login.
 *
 * La sesión de jurado es independiente de la del sitio: quien llegue sin ella
 * va a pasar por `/jurado/login`, que es la puerta de esa sesión y sabe volver.
 * Apuntar directo al login le mostraría un formulario a quien ya está adentro.
 */
export const PANEL_DE_JURADO_HREF = "/jurado/panel";
