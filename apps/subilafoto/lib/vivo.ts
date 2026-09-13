/**
 * El cursor de la transmisión en vivo.
 *
 * La pantalla del salón recibe las fotos nuevas por SSE. Cuando la conexión se
 * corta —y se corta: el wifi del salón, el límite de duración de la función—
 * el navegador reconecta solo y manda de vuelta el último identificador que
 * recibió, en la cabecera `Last-Event-ID`. Con eso se sabe desde dónde seguir.
 *
 * El cursor lleva **hora e identificador**, no sólo la hora. Dos fotos pueden
 * publicarse en el mismo milisegundo, y con la hora sola la segunda se pierde
 * para siempre o se repite en cada reconexión.
 */

export type Cursor = { publishedAt: Date; id: string };

export function codificarCursor(cursor: Cursor): string {
  return `${cursor.publishedAt.getTime()}-${cursor.id}`;
}

/**
 * Lee el cursor que devuelve el navegador.
 *
 * Devuelve `null` ante cualquier cosa rara y la transmisión arranca de cero.
 * El `Last-Event-ID` lo manda el cliente: puede venir de una pestaña vieja, de
 * una extensión o de un proxy que lo tocó. Confiar en él sin revisarlo sería
 * dejar que un valor ajeno arme una consulta.
 */
export function parsearCursor(crudo: string | null | undefined): Cursor | null {
  if (!crudo || crudo.length > 200) return null;

  const corte = crudo.indexOf("-");
  if (corte <= 0 || corte === crudo.length - 1) return null;

  const milisegundos = Number(crudo.slice(0, corte));
  if (!Number.isSafeInteger(milisegundos) || milisegundos <= 0) return null;

  // El id puede tener guiones, así que se corta sólo en el primero.
  const id = crudo.slice(corte + 1);
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return null;

  return { publishedAt: new Date(milisegundos), id };
}

/**
 * Qué traer después del cursor.
 *
 * Las dos ramas del `OR` son las que hacen que no se saltee ni se repita nada:
 * lo publicado más tarde, y lo publicado en el mismo instante con identificador
 * mayor. Ambas estrictas — con `gte` se repetiría la foto del cursor en cada
 * reconexión, y en una pantalla eso se ve.
 */
export type CondicionDePublicadas = {
  eventId: string;
  status: "APPROVED";
  publishedAt: { not: null };
  OR?: ({ publishedAt: { gt: Date } } | { publishedAt: Date; id: { gt: string } })[];
};

export function condicionDesdeCursor(
  eventoId: string,
  cursor: Cursor | null,
): CondicionDePublicadas {
  const base: CondicionDePublicadas = {
    eventId: eventoId,
    status: "APPROVED" as const,
    publishedAt: { not: null },
  };

  if (!cursor) return base;

  return {
    ...base,
    OR: [
      { publishedAt: { gt: cursor.publishedAt } },
      { publishedAt: cursor.publishedAt, id: { gt: cursor.id } },
    ],
  };
}

/**
 * Qué sacar de la pantalla.
 *
 * El canal manda cada tanto la lista completa de lo que está vigente, y la
 * pantalla se queda sólo con eso. Es la red de seguridad: los avisos de "sacá
 * esta" viajan sueltos y se pueden perder en un corte, pero la lista completa
 * corrige cualquier diferencia sin que nadie tenga que darse cuenta.
 *
 * Sin esto, una foto que el organizador oculta mientras la pantalla estuvo unos
 * segundos desconectada se queda proyectada toda la noche.
 */
export function idsAQuitar(
  vigentes: readonly string[],
  enPantalla: readonly string[],
): string[] {
  const siguenVigentes = new Set(vigentes);
  return enPantalla.filter((id) => !siguenVigentes.has(id));
}
