import { gruposDelEvento, gruposDelPanel, type Grupo } from "./panel-navegacion";

/**
 * Qué menú le toca a una pantalla, deducido de su dirección.
 *
 * Existe para que haya **un solo marco** en todo el panel. La alternativa era que el
 * marco del evento dibujara su propio menú además del general, y entonces adentro de un
 * evento se veían dos, uno encima del otro.
 *
 * Deducirlo de la dirección y no pasarlo hacia arriba es lo que lo hace posible: en
 * Next, un `layout` de adentro no le puede dar datos a uno de afuera.
 */

/** `nuevo` no es un identificador de evento: es la pantalla de crear uno. */
const NO_SON_EVENTOS = new Set(["nuevo"]);

export function gruposParaLaRuta(ruta: string): Grupo[] {
  const m = /^\/panel\/eventos\/([^/]+)/.exec(ruta);
  const id = m?.[1];

  /*
    Sin esto, `/panel/eventos/nuevo` se trataría como un evento de identificador
    "nuevo" y el menú tendría enlaces a `/panel/eventos/nuevo/moderacion`, que no
    existe: el fotógrafo llegaría a un 404 desde el propio menú.
  */
  if (!id || NO_SON_EVENTOS.has(id)) return gruposDelPanel();

  return gruposDelEvento(id);
}
