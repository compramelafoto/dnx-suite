/**
 * Tope de la nota institucional del pie de los emails.
 *
 * Vive acá y no en `actions.ts` porque ese archivo es `"use server"`: Next solo permite
 * exportar funciones async desde un módulo de server actions. Compartirla evita que la
 * validación del servidor y el `maxLength` del formulario diverjan.
 */
export const EMAIL_SIGNATURE_NOTE_MAX = 1500;

/**
 * Tope de lo que se guarda en `SentEmailLog.error`, que es texto libre.
 *
 * Vive acá y no junto al transporte para que el registro no tenga que importar el módulo de
 * envío solo por una constante: ese acoplamiento hacía fallar el registro en silencio
 * cuando un test reemplazaba el transporte.
 */
export const DETAIL_MAX = 500;
