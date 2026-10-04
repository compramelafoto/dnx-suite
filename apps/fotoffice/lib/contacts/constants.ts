/**
 * Valores fijos de la sincronización con Google Contacts.
 *
 * Están juntos y aparte porque cambiarlos rompe la sincronización de todas las
 * instituciones a la vez: cambiar `CLIENT_DATA_KEY` deja huérfanos a todos los contactos
 * ya creados, que pasarían a parecer ajenos y dejarían de actualizarse.
 */

/**
 * La marca que FOTOFFICE pone en los contactos que crea, en el campo `clientData` de la
 * People API —el equivalente de las `extendedProperties` que usa el espejo de Calendar—.
 *
 * **Sin esto la sincronización pisa la agenda personal de quien conectó la cuenta**: no
 * habría forma de distinguir un contacto nuestro de uno que ya estaba ahí.
 *
 * Es `clientData` y no `userDefined` a propósito: `userDefined` es el campo que la persona
 * edita a mano y que Google muestra en la pantalla del contacto.
 */
export const CLIENT_DATA_KEY = "fotofficeSource";

/** Prefijo de los grupos que crea la plataforma. Cada módulo tiene el suyo. */
export const GROUP_LABEL_PREFIX = "FOTOFFICE · ";

/**
 * Tope de ESCRITURAS por workspace y por corrida.
 *
 * Un padrón grande se sincroniza en varias corridas en vez de chocar contra la cuota de la
 * People API. No hace falta ninguna cola: lo pendiente se deduce —quien no tiene vínculo
 * todavía, o cuya huella dejó de coincidir.
 */
export const MAX_WRITES_PER_RUN = 200;
