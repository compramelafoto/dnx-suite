/**
 * A qué base pertenecen las obras y los votos de una asignación.
 *
 * El portal del jurado es uno solo, pero los datos están repartidos: un
 * concurso distribuido por Clickatón tiene sus obras en la base de Clickatón,
 * porque las claves foráneas no cruzan bases.
 *
 * Esta decisión está aislada acá a propósito: equivocarla guarda el voto en la
 * base que no es, y eso no se nota hasta que alguien busca los resultados.
 */

export type JuryPlatform = "fotorank" | "clickaton";

/** Canal de distribución que marca a un concurso como de Clickatón. */
const CLICKATON_CHANNEL = "CLICKATON";

export class JuryPlatformUnavailableError extends Error {
  constructor() {
    super(
      "No podemos acceder a las obras de Clickatón en este momento. Volvé a intentar en un rato.",
    );
    this.name = "JuryPlatformUnavailableError";
  }
}

export function platformForContest(contest: {
  distributionChannel: string | null;
}): JuryPlatform {
  return contest.distributionChannel === CLICKATON_CHANNEL ? "clickaton" : "fotorank";
}

export function platformLabel(platform: JuryPlatform): string {
  return platform === "clickaton" ? "Clickatón" : "FotoRank";
}
