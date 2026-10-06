/**
 * Direcciones viejas que siguen andando (redirecciones permanentes de `next.config.ts`).
 *
 * Captación pasó a llamarse Consultas el 06/10/2026 y su dirección pasó de `/captacion` a
 * `/consultas`. Los enlaces ya repartidos (favoritos, correos, el historial del navegador)
 * caen en la pantalla nueva: mismo camino debajo y misma búsqueda (`?circuito=…`), que Next
 * pasa sola al destino. Es 308: el navegador y los buscadores recuerdan el cambio.
 *
 * `captacion` sigue en `RESERVED_SLUGS`: ninguna institución puede tomar ese nombre y tapar
 * esta redirección.
 *
 * Va en un archivo aparte (y no escrito dentro de `next.config.ts`) para poder probarlo.
 */
export type RedireccionPermanente = {
  source: string;
  destination: string;
  permanent: true;
};

export const REDIRECCIONES_PERMANENTES: RedireccionPermanente[] = [
  { source: "/captacion", destination: "/consultas", permanent: true },
  { source: "/captacion/:camino*", destination: "/consultas/:camino*", permanent: true },
];
