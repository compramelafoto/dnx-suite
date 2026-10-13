import { armarConsulta } from "./enlace";

/**
 * La selección que va en el correo de presentación a sociedades, asociaciones y fotoclubes.
 *
 * Socios, cuotas, carnets, sorteos, sponsors (que es donde la marca carga el beneficio para los
 * socios), concursos (FotoRank) y muestras (Muestras Fotográficas). Está escrita acá y no a mano
 * en el correo para que `instituciones.test.ts` controle que todas las claves existan.
 */
export const SELECCION_INSTITUCIONES = {
  tipoId: "sociedad",
  modulos: ["members", "membership-dues", "carnets", "raffles", "sponsors", "concursos", "muestras"],
};

export const ENLACE_INSTITUCIONES = `https://fotoffice.com/${armarConsulta(SELECCION_INSTITUCIONES)}`;
