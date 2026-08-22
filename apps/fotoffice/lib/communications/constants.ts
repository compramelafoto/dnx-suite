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

/**
 * Parámetros de la herramienta "Enviar email de prueba".
 *
 * Viven en este módulo —que no importa Prisma— porque el panel es un componente cliente y
 * muestra el tope en pantalla. Tomarlos del módulo que hace las consultas arrastraría el
 * cliente de base de datos al bundle del navegador.
 */

/** Marca las filas de `SentEmailLog` que pertenecen a esta herramienta. */
export const TEST_EMAIL_TEMPLATE_KEY = "fotoffice.email-test";

/**
 * Tres pruebas por persona y por hora. El límite es de esta herramienta, no del envío en
 * general: las comunicaciones reales no pasan por acá.
 *
 * No hay tope por workspace en esta etapa. Agregarlo requeriría poder contar los envíos de
 * un workspace, y `SentEmailLog` no tiene esa columna; meterla a la fuerza en `templateKey`
 * o en `error` sería usar campos para lo que no son.
 */
export const PER_USER_HOURLY_LIMIT = 3;
export const RATE_LIMIT_WINDOW_MINUTES = 60;
