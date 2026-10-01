/**
 * Las categorías de proveedor.
 *
 * Salen del capítulo 14 del documento maestro. Se guarda **la clave**, no el texto: el
 * día que "DJ" pase a llamarse "Música en vivo", las fichas ya cargadas siguen valiendo.
 *
 * La lista no es cerrada — hay una categoría "otro" con nota libre — pero sí es la que se
 * ofrece. Un campo de texto libre en su lugar produce "catering", "Catering", "cattering"
 * y "servicio de comida" para lo mismo, y después nadie puede filtrar la base.
 */

export type Categoria = { clave: string; nombre: string };

export const CATEGORIAS: readonly Categoria[] = [
  { clave: "fotografia", nombre: "Fotografía" },
  { clave: "video", nombre: "Video" },
  { clave: "salon", nombre: "Salón y locación" },
  { clave: "catering", nombre: "Catering" },
  { clave: "barra", nombre: "Barra y bebidas" },
  { clave: "pasteleria", nombre: "Pastelería" },
  { clave: "dj", nombre: "DJ" },
  { clave: "sonido", nombre: "Sonido" },
  { clave: "iluminacion", nombre: "Iluminación" },
  { clave: "pantallas", nombre: "Pantallas y técnica" },
  { clave: "streaming", nombre: "Streaming" },
  { clave: "ambientacion", nombre: "Ambientación" },
  { clave: "flores", nombre: "Decoración floral" },
  { clave: "mobiliario", nombre: "Mobiliario" },
  { clave: "cotillon", nombre: "Cotillón" },
  { clave: "maquillaje", nombre: "Maquillaje y peinado" },
  { clave: "vestuario", nombre: "Vestuario" },
  { clave: "graficas", nombre: "Invitaciones y gráfica" },
  { clave: "imprenta", nombre: "Imprenta" },
  { clave: "cabina", nombre: "Cabina y experiencias fotográficas" },
  { clave: "espectaculos", nombre: "Música y espectáculos" },
  { clave: "animacion", nombre: "Animación" },
  { clave: "transporte", nombre: "Transporte" },
  { clave: "alojamiento", nombre: "Alojamiento" },
  { clave: "seguridad", nombre: "Seguridad" },
  { clave: "acreditaciones", nombre: "Acreditaciones" },
  { clave: "prensa", nombre: "Prensa y comunicación" },
  { clave: "organizador", nombre: "Organizador de eventos" },
  { clave: "congresos", nombre: "Productor de congresos" },
  { clave: "otro", nombre: "Otro" },
] as const;

const POR_CLAVE = new Map(CATEGORIAS.map((c) => [c.clave, c]));

/** El nombre visible de una categoría, o la clave misma si no está en la lista. */
export function nombreDeCategoria(clave: string): string {
  return POR_CLAVE.get(clave)?.nombre ?? clave;
}

/** ¿Esta clave existe? Lo que llega de un formulario público no se cree sin revisar. */
export function esCategoriaValida(clave: string): boolean {
  return POR_CLAVE.has(clave);
}

/**
 * El enlace por categoría.
 *
 * El capítulo 14 pide poder generar un enlace por rubro además del general: mandarle al
 * salón uno que ya diga "salón" le ahorra un paso y, sobre todo, evita que el catering se
 * anote como fotografía por elegir mal en una lista de treinta.
 *
 * La categoría viaja en la etiqueta del enlace y no en una columna nueva: es un dato del
 * enlace, no del evento, y `SubilafotoAccessLink` ya tiene dónde ponerlo.
 */
const PREFIJO = "categoria:";

export function etiquetaDeCategoria(clave: string): string {
  return `${PREFIJO}${clave}`;
}

/**
 * Qué categoría trae un enlace, o `null` si es el general.
 *
 * Una categoría que ya no está en la lista devuelve `null` y el enlace se comporta como
 * general: sacar una categoría no puede romper los enlaces que alguien ya repartió.
 */
export function categoriaDelEnlace(etiqueta: string | null | undefined): string | null {
  if (!etiqueta?.startsWith(PREFIJO)) return null;
  const clave = etiqueta.slice(PREFIJO.length);
  return esCategoriaValida(clave) ? clave : null;
}
