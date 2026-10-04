/**
 * Constantes del módulo Solicitudes y Coberturas.
 *
 * La clave es `coverages` y no `jobs` ni `requests` para no confundirlo con dos vecinos:
 * `work-orders`, que custodia un objeto ajeno y cobra, y `events`, reservado para eventos con
 * inscripción. Son tres cosas distintas y el nombre tiene que decirlo.
 */
export const COVERAGES_MODULE_KEY = "coverages";

/** Todo lo que se le muestra a una persona se lee en esta zona. */
export const COVERAGES_TIME_ZONE = "America/Argentina/Buenos_Aires";

/** Prefijo del código público. `SC-2026-0042`. */
export const PUBLIC_CODE_PREFIX = "SC";

/**
 * Cuántos avisos de convocatoria salen a la vez.
 *
 * Cinco y no cincuenta: en paralelo la espera de quien apretó «Publicar» baja de un envío por
 * persona a un envío por tanda, y cinco conexiones simultáneas es lo que un proveedor de correo
 * acepta sin empezar a rechazar por ritmo.
 */
export const CALL_NOTICE_BATCH_SIZE = 5;

/**
 * Cuántos destinatarios como mucho alcanza el aviso de una convocatoria.
 *
 * Un tope explícito y no "todos los que haya": una institución con miles de colaboradores
 * activos dejaría la Server Action mandando correos hasta que la función se corte, y ahí la
 * convocatoria ya quedó publicada y nadie sabe cuántos avisos salieron. Con tope, la corrida
 * termina siempre.
 *
 * **Es un techo del módulo en esta etapa, no una primera página.** El orden es estable (por
 * apellido), así que el tope corta siempre por el mismo lado: al colaborador 201 no le llega el
 * aviso, ni en la publicación ni en el reenvío. Por eso la acción compara el tope contra cuántos
 * colaboradores activos hay de verdad y, si sobran, lo dice en pantalla en vez de dejar creer
 * que la institución entera se enteró. Doscientos es holgado para las instituciones de esta
 * etapa; pasarlo pide repartir el envío en varias corridas, que es trabajo del cron (1c).
 */
export const CALL_NOTICE_MAX_RECIPIENTS = 200;
