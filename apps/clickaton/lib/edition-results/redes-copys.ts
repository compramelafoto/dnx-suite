/**
 * El texto del posteo de cada consigna, listo para pegar en Instagram.
 *
 * Cada plantilla presenta la consigna, nombra a los finalistas en orden de
 * puesto, saluda a las menciones si las hay e invita a votar en las encuestas
 * de los comentarios, como el posteo original de @clickaton.ok. Hay muchas
 * para que el feed no repita la misma frase consigna tras consigna: dentro de
 * un mismo ZIP no se usa dos veces la misma.
 *
 * Marcas:
 *   {CONSIGNA}    nombre de la consigna, en mayúsculas
 *   {FINALISTAS}  "@a, @b y @c", en orden de puesto
 *   {PODIO}       una línea por finalista: "1.º @a"
 *   {MENCION}     línea de saludo a los puestos siguientes; si no hay, se borra
 *   {HASHTAGS}
 */

export const PLANTILLAS_DE_COPY: readonly string[] = [
  `¡Le toca el turno a: {CONSIGNA}! 📸

Y las fotos finalistas pertenecen a: {FINALISTAS}.

{MENCION}

¡Empieza la votación! Recordá que se hace a través de encuestas acá abajo (se despliega al abrir los comentarios y se clickea la foto elegida).

{HASHTAGS}`,

  `Consigna: {CONSIGNA} ✨

Estas son las tres fotos que eligió el jurado, en orden:
{PODIO}

{MENCION}

Ahora decidís vos 👇 Abrí los comentarios, buscá la encuesta y votá tu favorita.

{HASHTAGS}`,

  `📣 ¡Llegaron las finalistas de {CONSIGNA}!

Felicitaciones a {FINALISTAS} por llegar hasta acá.

{MENCION}

La votación ya está abierta: entrá a los comentarios y elegí tu foto en la encuesta.

{HASHTAGS}`,

  `{CONSIGNA}. Así la vieron nuestros finalistas 👀

{PODIO}

{MENCION}

¿Cuál te gusta más? Votá en la encuesta de los comentarios.

{HASHTAGS}`,

  `Seguimos con las consignas: ahora es el turno de {CONSIGNA} 🔥

El jurado ya habló y las finalistas son de {FINALISTAS}.

{MENCION}

Te toca a vos: la encuesta está en los comentarios. ¡A votar!

{HASHTAGS}`,

  `Pasá las fotos ➡️ y conocé a las finalistas de {CONSIGNA}.

En orden de puesto:
{PODIO}

{MENCION}

Para votar, abrí los comentarios y clickeá la foto que elijas en la encuesta.

{HASHTAGS}`,

  `¡Qué nivel tuvo {CONSIGNA}! 🙌

Las tres que pasaron a la final son de {FINALISTAS}.

{MENCION}

Empieza la votación del público: encuesta en los comentarios, un click y listo.

{HASHTAGS}`,

  `Consigna {CONSIGNA}: tres miradas, tres fotos finalistas 📷

{PODIO}

{MENCION}

¿Quién se lleva tu voto? Lo decidís en la encuesta de los comentarios.

{HASHTAGS}`,

  `Ya están las finalistas de {CONSIGNA} 🎉

Felicitamos a {FINALISTAS}, que quedaron primero, segundo y tercero según el jurado.

{MENCION}

Ahora vota la comunidad: abrí los comentarios y elegí en la encuesta.

{HASHTAGS}`,

  `{CONSIGNA} 📸 Así quedó el podio del jurado:

{PODIO}

{MENCION}

La votación está abierta en los comentarios. ¡Tu voto cuenta!

{HASHTAGS}`,

  `Otra consigna que nos dejó con la boca abierta: {CONSIGNA} 😮

Las finalistas pertenecen a {FINALISTAS}.

{MENCION}

¿Ya elegiste tu favorita? Votala en la encuesta que se despliega al abrir los comentarios.

{HASHTAGS}`,

  `Presentamos las finalistas de {CONSIGNA} 🏁

{PODIO}

{MENCION}

Mirá las tres, pensalo bien y votá tu favorita en la encuesta de los comentarios.

{HASHTAGS}`,

  `¿Cómo se fotografía {CONSIGNA}? Así lo resolvieron {FINALISTAS} 👏

{MENCION}

Son las tres finalistas y ahora te toca votar: encuesta en los comentarios.

{HASHTAGS}`,

  `Turno de {CONSIGNA} ⏱️

El jurado eligió estas tres, en este orden:
{PODIO}

{MENCION}

Entrá a los comentarios y votá. ¡Empieza la votación!

{HASHTAGS}`,

  `Finalistas de {CONSIGNA} ✅

Las fotos son de {FINALISTAS}. ¡Felicitaciones!

{MENCION}

Para votar: abrí los comentarios, encontrá la encuesta y clickeá la foto que más te guste.

{HASHTAGS}`,

  `Una consigna, muchas formas de verla. Estas son las finalistas de {CONSIGNA} 🖼️

{PODIO}

{MENCION}

¿Con cuál te quedás? Votá en la encuesta de los comentarios.

{HASHTAGS}`,

  `¡Atención! Ya se conocen las finalistas de {CONSIGNA} 📢

Pertenecen a {FINALISTAS}.

{MENCION}

La última palabra es tuya: votá en la encuesta de acá abajo, en los comentarios.

{HASHTAGS}`,

  `{CONSIGNA} 🎯

Primero, segundo y tercero para el jurado:
{PODIO}

{MENCION}

Ahora vota el público. La encuesta está en los comentarios.

{HASHTAGS}`,

  `Deslizá para ver las finalistas de {CONSIGNA} 👉

Son obras de {FINALISTAS}, en orden de puesto.

{MENCION}

¿Tu favorita? Contanos con tu voto en la encuesta de los comentarios.

{HASHTAGS}`,

  `Nos encantó lo que hicieron con {CONSIGNA} 💛

Las finalistas:
{PODIO}

{MENCION}

¡Empieza la votación! Abrí los comentarios y elegí en la encuesta.

{HASHTAGS}`,

  `Llegó el momento de {CONSIGNA} 🚀

El jurado de FotoRank eligió las fotos de {FINALISTAS}.

{MENCION}

Ahora te toca votar a vos: encuesta en los comentarios, un click por la foto que elijas.

{HASHTAGS}`,

  `Consigna {CONSIGNA}. Las finalistas, en orden:

{PODIO}

{MENCION}

Mirá cada detalle y votá en la encuesta de los comentarios 🗳️

{HASHTAGS}`,

  `¡Aplausos para {FINALISTAS}! 👏👏👏

Son las tres finalistas de {CONSIGNA}.

{MENCION}

La votación ya arrancó: la encontrás en los comentarios.

{HASHTAGS}`,

  `{CONSIGNA}: el jurado ya eligió, ahora elegís vos ✋

{PODIO}

{MENCION}

Abrí los comentarios para ver la encuesta y votar.

{HASHTAGS}`,

  `Esto es {CONSIGNA} según nuestros participantes 📸

Las finalistas son de {FINALISTAS}.

{MENCION}

¿Cuál es tu preferida? Votá en la encuesta que aparece en los comentarios.

{HASHTAGS}`,

  `Abrimos la votación de {CONSIGNA} 🗳️

Finalistas, en orden de puesto:
{PODIO}

{MENCION}

La encuesta está en los comentarios. ¡No te quedes sin votar!

{HASHTAGS}`,

  `Tres fotos, una consigna: {CONSIGNA} 🔎

Felicitaciones a {FINALISTAS}, nuestros finalistas.

{MENCION}

Votá tu favorita en la encuesta de los comentarios.

{HASHTAGS}`,

  `¡Seguimos! Ahora mostramos las finalistas de {CONSIGNA} 🙌

{PODIO}

{MENCION}

Para votar, desplegá los comentarios y clickeá la foto elegida en la encuesta.

{HASHTAGS}`,

  `{CONSIGNA} se vivió así 💥

Las tres finalistas pertenecen a {FINALISTAS}.

{MENCION}

¿Ya votaste? La encuesta te espera en los comentarios.

{HASHTAGS}`,

  `Te presentamos el podio del jurado en {CONSIGNA} 🏆

{PODIO}

{MENCION}

Ahora es el turno del público: votá en la encuesta de los comentarios.

{HASHTAGS}`,

  `Consigna {CONSIGNA}, finalistas confirmadas ✔️

Son de {FINALISTAS}.

{MENCION}

Abrí los comentarios, mirá la encuesta y votá tu foto.

{HASHTAGS}`,

  `Hay fotos que no se olvidan. Las finalistas de {CONSIGNA} son de:

{PODIO}

{MENCION}

¡Empieza la votación! Está en los comentarios.

{HASHTAGS}`,

  `¿Qué es {CONSIGNA} para vos? Para el jurado, estas tres fotos 📷

Felicitaciones a {FINALISTAS}.

{MENCION}

Votá tu favorita en la encuesta de los comentarios.

{HASHTAGS}`,

  `Sale una consigna más: {CONSIGNA} 🎬

{PODIO}

{MENCION}

La encuesta para votar se despliega en los comentarios. ¡A elegir!

{HASHTAGS}`,

  `Finalistas de {CONSIGNA}, en orden de puesto: {FINALISTAS} 🌟

{MENCION}

Ahora decidís vos. Votá en la encuesta de los comentarios.

{HASHTAGS}`,

  `¡Mirá lo que lograron con {CONSIGNA}! 😍

{PODIO}

{MENCION}

¿Cuál merece tu voto? Encuesta en los comentarios.

{HASHTAGS}`,

  `{CONSIGNA} 📸 Las finalistas ya están acá.

Pertenecen a {FINALISTAS}, como lo decidió el jurado.

{MENCION}

Sumá tu voto en la encuesta de los comentarios.

{HASHTAGS}`,

  `Te dejamos las finalistas de {CONSIGNA} para que votes 🗳️

{PODIO}

{MENCION}

Abrí los comentarios: ahí está la encuesta.

{HASHTAGS}`,

  `Arranca la votación de {CONSIGNA} ⏳

Finalistas: {FINALISTAS}.

{MENCION}

Un voto por persona, en la encuesta de los comentarios. ¡Elegí bien!

{HASHTAGS}`,

  `Así se ve {CONSIGNA} a través de tres miradas distintas 👁️

{PODIO}

{MENCION}

Votá la que más te guste en la encuesta de los comentarios.

{HASHTAGS}`,

  `¡Felicitaciones, {FINALISTAS}! 🎊

Son las finalistas de {CONSIGNA}.

{MENCION}

Y ahora, ¡a votar! La encuesta se abre en los comentarios.

{HASHTAGS}`,

  `{CONSIGNA}: las tres finalistas, en orden de puesto 📸

{PODIO}

{MENCION}

¿Tu elección? Votá en los comentarios.

{HASHTAGS}`,

  `Nueva consigna en pantalla: {CONSIGNA} 🖥️

El jurado eligió las fotos de {FINALISTAS}.

{MENCION}

Desplegá los comentarios y votá en la encuesta.

{HASHTAGS}`,

  `¡Qué difícil fue elegir en {CONSIGNA}! Estas llegaron a la final:

{PODIO}

{MENCION}

Ahora el difícil sos vos: votá en la encuesta de los comentarios 😉

{HASHTAGS}`,

  `Consigna {CONSIGNA} ✨ Finalistas: {FINALISTAS}.

{MENCION}

La votación está abierta. Buscá la encuesta en los comentarios y clickeá tu favorita.

{HASHTAGS}`,

  `Conocé el podio de {CONSIGNA} 🥇🥈🥉

{PODIO}

{MENCION}

¿Coincidís con el jurado? Votá en la encuesta de los comentarios.

{HASHTAGS}`,

  `{CONSIGNA} nos regaló fotazas 🔥

Las finalistas son de {FINALISTAS}.

{MENCION}

Entrá a los comentarios y votá la tuya en la encuesta.

{HASHTAGS}`,

  `Otra consigna, otra votación: {CONSIGNA} 🗳️

{PODIO}

{MENCION}

La encuesta está en los comentarios. ¡Te esperamos!

{HASHTAGS}`,

  `Ellas son las finalistas de {CONSIGNA} 📸

Fotos de {FINALISTAS}, en el orden que eligió el jurado.

{MENCION}

¡Votá tu favorita en la encuesta de los comentarios!

{HASHTAGS}`,

  `Consigna {CONSIGNA}. Del jurado al público 👇

{PODIO}

{MENCION}

Ahora te toca votar: abrí los comentarios y elegí en la encuesta.

{HASHTAGS}`,

  `¡Vamos con {CONSIGNA}! 💪

Las tres finalistas pertenecen a {FINALISTAS}.

{MENCION}

¿Ya sabés cuál votar? La encuesta está en los comentarios.

{HASHTAGS}`,

  `{CONSIGNA}, en tres fotos finalistas 🎞️

{PODIO}

{MENCION}

Empieza la votación: encuesta en los comentarios, un click y listo.

{HASHTAGS}`,

  `Para {CONSIGNA}, el jurado eligió a {FINALISTAS} 🏅

{MENCION}

Ahora vota la comunidad. Abrí los comentarios y elegí tu foto.

{HASHTAGS}`,

  `Llegamos a {CONSIGNA} y la vara quedó altísima 📈

{PODIO}

{MENCION}

¿Cuál te parece la mejor? Votá en la encuesta de los comentarios.

{HASHTAGS}`,

  `Finalistas de {CONSIGNA} 📸 ¡Felicitaciones a {FINALISTAS}!

{MENCION}

La votación ya empezó. Encontrás la encuesta en los comentarios.

{HASHTAGS}`,
];

/** Saludo a los puestos que siguen al podio. {MENCIONADOS} y {LUGAR}. */
export const PLANTILLAS_DE_MENCION: readonly string[] = [
  "¡Felicitaciones también para {MENCIONADOS} por {LUGAR}! 💖",
  "Y un aplauso enorme para {MENCIONADOS}, que se quedaron con {LUGAR} 👏",
  "Mención especial para {MENCIONADOS} por {LUGAR} 💛",
  "¡Felicitaciones a {MENCIONADOS} por {LUGAR}! Estuvieron muy cerca ✨",
  "No nos olvidamos de {MENCIONADOS}: ¡felicitaciones por {LUGAR}! 🙌",
  "También celebramos a {MENCIONADOS} por {LUGAR} 🎉",
  "¡Bravo, {MENCIONADOS}, por {LUGAR}! 👏",
  "Felicitaciones para {MENCIONADOS}, que quedaron con {LUGAR} 💪",
];

export const HASHTAGS_DE_CLICKATON = "#clickaton #click #concurso #fotos #fotografia";

export type PersonaDelCopy = { puesto: number; nombre: string; instagram: string | null };

function ordinal(n: number): string {
  return `${n}.º`;
}

function mencionDe(p: PersonaDelCopy): string {
  const ig = p.instagram?.trim().replace(/^@+/, "");
  return ig ? `@${ig}` : p.nombre;
}

export function enumerar(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

/** Del 1 al 3 son finalistas; del 4 en adelante, menciones. */
export const ULTIMO_PUESTO_FINALISTA = 3;

/** Generador pseudoaleatorio con semilla: el mismo ZIP sale igual si se repite la semilla. */
export function aleatorioConSemilla(semilla: number): () => number {
  let s = semilla >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Los índices de plantilla mezclados: se toman en orden y no se repiten hasta agotarlas. */
export function mezclarPlantillas(azar: () => number, cantidad = PLANTILLAS_DE_COPY.length): number[] {
  const indices = Array.from({ length: cantidad }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(azar() * (i + 1));
    [indices[i], indices[j]] = [indices[j]!, indices[i]!];
  }
  return indices;
}

/** Las plantillas que hablan de "tres" sólo sirven cuando hay tres nombrados. */
export function hablaDeTres(plantilla: string): boolean {
  return /\btres\b|primero, segundo y tercero|🥇🥈🥉/i.test(plantilla);
}

/** Desde el índice pedido, la primera plantilla que encaja con la cantidad de nombrados. */
export function plantillaQueSirve(desde: number, nombrados: number): number {
  const total = PLANTILLAS_DE_COPY.length;
  for (let paso = 0; paso < total; paso++) {
    const i = (((desde + paso) % total) + total) % total;
    if (nombrados === 3 || !hablaDeTres(PLANTILLAS_DE_COPY[i]!)) return i;
  }
  return 0;
}

export function armarCopy(input: {
  consigna: string;
  personas: PersonaDelCopy[];
  plantilla: number;
  azar: () => number;
}): string {
  const ordenadas = [...input.personas].sort(
    (a, b) => a.puesto - b.puesto || a.nombre.localeCompare(b.nombre, "es"),
  );
  const finalistas = ordenadas.filter((p) => p.puesto <= ULTIMO_PUESTO_FINALISTA);
  const siguientes = ordenadas.filter((p) => p.puesto > ULTIMO_PUESTO_FINALISTA);
  // Si el filtro no incluyó el podio, los que hay ocupan su lugar en el texto.
  const nombrados = finalistas.length > 0 ? finalistas : siguientes;
  const menciones = finalistas.length > 0 ? siguientes : [];

  const puestosDeMencion = [...new Set(menciones.map((p) => p.puesto))];
  const lugar =
    puestosDeMencion.length === 1
      ? `su ${ordinal(puestosDeMencion[0]!)} puesto`
      : "quedar entre los mejores de la consigna";
  const lineaDeMencion =
    menciones.length > 0
      ? PLANTILLAS_DE_MENCION[Math.floor(input.azar() * PLANTILLAS_DE_MENCION.length)]!
          .replace("{MENCIONADOS}", enumerar(menciones.map(mencionDe)))
          .replace("{LUGAR}", lugar)
      : "";

  const plantilla = PLANTILLAS_DE_COPY[plantillaQueSirve(input.plantilla, nombrados.length)]!;
  return plantilla
    .replaceAll("{CONSIGNA}", input.consigna.toLocaleUpperCase("es-AR"))
    .replaceAll("{FINALISTAS}", enumerar(nombrados.map(mencionDe)))
    .replaceAll(
      "{PODIO}",
      nombrados.map((p) => `${ordinal(p.puesto)} ${mencionDe(p)}`).join("\n"),
    )
    .replaceAll("{HASHTAGS}", HASHTAGS_DE_CLICKATON)
    .replace(lineaDeMencion ? "{MENCION}" : "\n\n{MENCION}", lineaDeMencion)
    .trim();
}
