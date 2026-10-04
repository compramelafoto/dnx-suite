/** Textos legales / producto — reutilizar en UI de invitaciones y directorio. */

export const EXTERNAL_PAYMENT_DISCLAIMER =
  "Fotorank facilita el contacto y la gestión entre organizadores y jurados, pero no intermedia pagos ni garantiza acuerdos económicos realizados por fuera de la plataforma.";

/**
 * El anuncio del cobro por la plataforma, separado del descargo a propósito.
 *
 * El descargo dice lo que FotoRank NO hace hoy y es una afirmación legal:
 * mezclarle una promesa futura la debilita. Además, el descargo también lo lee
 * el organizador al enviar una invitación, y este anuncio está dirigido al
 * jurado.
 *
 * **Cuando el cobro se encienda, esta constante se borra** y con ella los
 * lugares que la muestran. No dice una fecha porque no depende de nosotros:
 * está esperando la homologación de Mercado Pago.
 */
export const COBRO_POR_LA_PLATAFORMA_PROXIMAMENTE =
  "Estamos trabajando para que puedas cobrar tu trabajo como jurado dentro de FotoRank: el organizador del concurso te paga por la plataforma y vos recibís el dinero en tu cuenta.";

export const DIRECTORY_PRIVACY_NOTE =
  "La visibilidad en el directorio es opcional: vos elegís qué datos mostrar. Fotorank puede moderar perfiles públicos ante abuso o incumplimiento de las condiciones.";

export const INVITE_MODAL_FOOTNOTE = `${EXTERNAL_PAYMENT_DISCLAIMER} Al enviar esta invitación confirmás que los honorarios o condiciones económicas se acuerdan fuera de Fotorank.`;

export const DIRECTORIO_ES_DE_TODA_LA_PLATAFORMA =
  "El directorio de jurados es común a todos los organizadores de FotoRank, no de una sola institución. Si aprobamos tu ficha, cualquiera de ellos va a poder verla y proponerte un concurso.";

export const QUE_PASA_DESPUES_DE_POSTULARSE =
  "Vas a poder entrar y completar tu ficha enseguida. Para que aparezca publicada hacen falta dos cosas: que confirmes tu correo y que la revisemos.";
