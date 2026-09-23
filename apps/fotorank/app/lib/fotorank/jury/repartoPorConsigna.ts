/**
 * Cómo se reparten las consignas entre los jurados.
 *
 * Con 270 obras y cinco jurados, pedirle a cada uno que califique las 270 por
 * cuatro criterios son 1080 notas: nadie termina, y el que termina ya no mira
 * igual. El reparto es por **consigna entera** —"te tocan la 1, la 2 y la
 * 6"— porque es lo único que se explica en una frase y lo único que deja al
 * jurado comparar entre sí fotos que compiten entre sí.
 *
 * La rotación es un corrimiento de a uno: la consigna i la toman los jurados
 * i, i+1, … i+m-1 dando la vuelta a la lista. Sale una tabla pareja sin
 * sorteo ni semilla, y la misma todas las veces.
 */

export type ParConsignaJurado = {
  consignaId: string;
  juradoId: string;
};

export function repartoPorConsigna(input: {
  consignas: string[];
  jurados: string[];
  miradasPorObra: number;
}): ParConsignaJurado[] {
  const jurados = input.jurados;
  if (input.consignas.length === 0 || jurados.length === 0) return [];

  const miradas = Math.min(Math.max(1, Math.floor(input.miradasPorObra)), jurados.length);

  const pares: ParConsignaJurado[] = [];
  input.consignas.forEach((consignaId, i) => {
    for (let paso = 0; paso < miradas; paso++) {
      pares.push({ consignaId, juradoId: jurados[(i + paso) % jurados.length]! });
    }
  });
  return pares;
}

/**
 * Cuánto trabajo le queda a cada jurado, para decirlo antes de repartir.
 */
export function cargaDelReparto(input: {
  obras: number;
  consignas: number;
  jurados: number;
  miradasPorObra: number;
  criterios?: number;
}): { consignasPorJurado: number; fotosPorJurado: number; notasPorJurado: number } {
  const vacio = { consignasPorJurado: 0, fotosPorJurado: 0, notasPorJurado: 0 };
  if (input.jurados < 1 || input.consignas < 1 || input.obras < 1) return vacio;

  const miradas = Math.min(Math.max(1, Math.floor(input.miradasPorObra)), input.jurados);
  const consignasPorJurado = Math.ceil((input.consignas * miradas) / input.jurados);
  const fotosPorJurado = Math.round((input.obras * miradas) / input.jurados);
  const criterios = input.criterios ?? 4;

  return {
    consignasPorJurado,
    fotosPorJurado,
    notasPorJurado: fotosPorJurado * criterios,
  };
}

/**
 * Qué consignas le tocan a un jurado según sus asignaciones.
 *
 * `null` significa "todas": es el caso de siempre, cuando el organizador no
 * repartió nada. Que la ausencia de reparto abra todo y no cierre todo es a
 * propósito — un error acá no puede dejar a un jurado mirando una pantalla
 * vacía sin entender por qué.
 */
export function consignasDelJurado(
  asignaciones: Array<{ promptExternalId: string | null }>,
): Set<string> | null {
  const conConsigna = asignaciones
    .map((a) => a.promptExternalId)
    .filter((id): id is string => Boolean(id));
  return conConsigna.length === 0 ? null : new Set(conConsigna);
}

/** Si una obra de esa consigna entra en la cola de ese jurado. */
export function leTocaLaConsigna(
  consignas: Set<string> | null,
  promptExternalId: string | null,
): boolean {
  if (consignas === null) return true;
  if (!promptExternalId) return false;
  return consignas.has(promptExternalId);
}
