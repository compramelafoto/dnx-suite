/**
 * Espejo de `apps/fotorank/app/lib/fotorank/jury/repartoPorConsigna.ts`.
 *
 * Clickatón no importa de FotoRank a propósito —evita arrastrar Prisma y acoplar
 * los builds, como ya está anotado en `data/public-marathons/fotorank-v1-types.ts`—,
 * así que esta copia tiene que quedar **idéntica** a la original. Si cambia una,
 * cambia la otra: un reparto distinto de cada lado le mostraría al jurado obras
 * que el organizador no le asignó, y nadie se enteraría hasta buscar los votos.
 *
 * Las pruebas de `reparto.test.ts` son las mismas de allá, por la misma razón:
 * son las que avisan si las dos copias se separaron.
 *
 * ---
 *
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

export type Excepcion = { seatNumber: number; promptExternalId: string };

/**
 * Qué consignas le tocan a una vacante.
 *
 * El reparto no se guarda: se calcula acá cada vez, con la misma rotación
 * determinista. Guardarlo crearía un estado que algún día no coincide con el
 * cálculo. Lo único que se persiste son las excepciones, y sólo existen cuando
 * alguien redistribuyó a mano el lote de una vacante que quedó vacía.
 */
export function consignasDeLaVacante(input: {
  consignas: string[];
  vacantes: number;
  miradasPorObra: number;
  seatNumber: number;
  excepciones?: Excepcion[];
}): Set<string> {
  const suyas = new Set<string>();
  if (input.seatNumber < 1 || input.seatNumber > input.vacantes) return suyas;

  const numeros = Array.from({ length: Math.floor(input.vacantes) }, (_, i) => String(i + 1));
  const pares = repartoPorConsigna({
    consignas: input.consignas,
    jurados: numeros,
    miradasPorObra: input.miradasPorObra,
  });

  for (const par of pares) {
    if (par.juradoId === String(input.seatNumber)) suyas.add(par.consignaId);
  }
  for (const e of input.excepciones ?? []) {
    if (e.seatNumber === input.seatNumber) suyas.add(e.promptExternalId);
  }
  return suyas;
}
