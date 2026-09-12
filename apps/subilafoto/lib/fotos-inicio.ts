/**
 * Las fotos de la franja que se mueve en la portada.
 *
 * Son diez escenas elegidas para mostrar lo único que hay que entender de la
 * plataforma en dos segundos: alguien apunta el celular a un código y su foto
 * termina en la pantalla del salón. Nada de fotos de producto ni de pantallas
 * de la aplicación.
 *
 * Los archivos viven en `public/inicio/`. Se sirven desde el propio dominio a
 * propósito: enlazar a un CDN ajeno deja la portada de un producto que se vende
 * a merced de que ese servicio siga respondiendo.
 */

export type FotoInicio = {
  /** Ruta pública del archivo, siempre bajo `/inicio/`. */
  src: string;
  /** Qué se ve. Lo lee el lector de pantalla y es el pie de la imagen. */
  alt: string;
  /** Verdadero sólo en la segunda vuelta del bucle, que no se anuncia. */
  duplicada: boolean;
};

export const FOTOS_INICIO: readonly FotoInicio[] = [
  {
    src: "/inicio/01-escanear-qr-en-la-mesa.jpg",
    alt: "Una invitada apunta la cámara del celular al código de la mesa durante una fiesta",
    duplicada: false,
  },
  {
    src: "/inicio/02-mirar-la-pantalla-del-salon.jpg",
    alt: "Un grupo de amigos se reconoce en la pantalla grande del salón",
    duplicada: false,
  },
  {
    src: "/inicio/03-celular-sobre-el-centro-de-mesa.jpg",
    alt: "Un celular escanea el centro de mesa impreso con el código del evento",
    duplicada: false,
  },
  {
    src: "/inicio/04-los-novios-miran-las-fotos.jpg",
    alt: "Los novios se ríen mirando juntos las fotos que subieron los invitados",
    duplicada: false,
  },
  {
    src: "/inicio/05-mosaico-en-la-pantalla.jpg",
    alt: "La pantalla del salón muestra un mosaico con las fotos del evento",
    duplicada: false,
  },
  {
    src: "/inicio/06-selfie-en-el-cumpleanos-de-quince.jpg",
    alt: "Dos amigas se sacan una selfie en una fiesta de quince años",
    duplicada: false,
  },
  {
    src: "/inicio/07-abuela-subiendo-su-foto.jpg",
    alt: "Una señora sube su foto con el celular, ayudada por un joven de la familia",
    duplicada: false,
  },
  {
    src: "/inicio/08-el-codigo-en-la-mesa.jpg",
    alt: "El cartel con el código sobre la mesa, con la fiesta desenfocada detrás",
    duplicada: false,
  },
  {
    src: "/inicio/09-festejo-frente-a-la-pantalla.jpg",
    alt: "Invitados festejan frente a la pantalla cuando aparece su foto",
    duplicada: false,
  },
  {
    src: "/inicio/10-egreso-escolar-compartiendo.jpg",
    alt: "Dos compañeros de egreso escolar se muestran las fotos en el celular",
    duplicada: false,
  },
];

/**
 * Devuelve la lista dos veces seguidas.
 *
 * La franja se desplaza exactamente el ancho de una copia y vuelve a cero. Con
 * la segunda copia detrás, ese salto no se ve. La copia va marcada para poder
 * ocultarla del lector de pantalla: si no, anuncia diez fotos dos veces.
 */
export function duplicarParaBucle(
  fotos: readonly FotoInicio[],
): readonly FotoInicio[] {
  return [...fotos, ...fotos.map((foto) => ({ ...foto, duplicada: true }))];
}
