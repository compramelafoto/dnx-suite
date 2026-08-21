/**
 * Tope de la nota institucional del pie de los emails.
 *
 * Vive acá y no en `actions.ts` porque ese archivo es `"use server"`: Next solo permite
 * exportar funciones async desde un módulo de server actions. Compartirla evita que la
 * validación del servidor y el `maxLength` del formulario diverjan.
 */
export const EMAIL_SIGNATURE_NOTE_MAX = 1500;
