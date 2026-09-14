/**
 * Las fotos de la franja que se mueve en la portada.
 *
 * Muestran lo único que hay que entender de la plataforma en dos segundos:
 * alguien apunta el celular a un código y su foto termina en la pantalla del
 * salón. El orden alterna primeros planos y planos generales para que la franja
 * no se vea repetitiva al desplazarse.
 *
 * Los archivos viven en `public/inicio/` y se sirven desde el propio dominio a
 * propósito: enlazar a un CDN ajeno deja la portada de un producto que se vende
 * a merced de que ese servicio siga respondiendo.
 */

export type FotoInicio = {
  /** Ruta pública del archivo, siempre bajo `/inicio/`. */
  src: string;
  /** Qué se ve. Lo lee el lector de pantalla. */
  alt: string;
  /** Verdadero en las copias del bucle, que no se anuncian. */
  duplicada: boolean;
};

/**
 * Cuántas veces se repite la lista en la pista.
 *
 * La animación desplaza **una copia** y vuelve a cero. Lo que queda detrás
 * tiene que alcanzar para tapar la pantalla más ancha, o al reiniciar se ve el
 * vacío del final. Con siete fotos, dos copias no alcanzan en un monitor
 * grande; con cuatro sobra hasta en un ultrapanorámico.
 *
 * **Si cambia este número hay que cambiar también el `translateX` de
 * `slf-desfile` en `globals.css`.** Hay un test que verifica que coincidan.
 */
export const COPIAS_DEL_BUCLE = 4;

export const FOTOS_INICIO: readonly FotoInicio[] = [
  {
    src: "/inicio/01-escanear-el-codigo.jpg",
    alt: "Una invitada escanea con el celular el código que está sobre la mesa del casamiento",
    duplicada: false,
  },
  {
    src: "/inicio/02-la-pantalla-del-salon.jpg",
    alt: "Los invitados miran la pantalla del salón, que muestra un mosaico con las fotos del evento",
    duplicada: false,
  },
  {
    src: "/inicio/03-selfie-en-la-fiesta.jpg",
    alt: "Dos amigas se sacan una selfie en la fiesta",
    duplicada: false,
  },
  {
    src: "/inicio/04-el-codigo-en-la-mesa.jpg",
    alt: "El cartel con el código del evento, parado sobre la mesa, con la fiesta desenfocada detrás",
    duplicada: false,
  },
  {
    src: "/inicio/05-los-novios-miran-las-fotos.jpg",
    alt: "Los novios se ríen mirando juntos en el celular las fotos que subieron los invitados",
    duplicada: false,
  },
  {
    src: "/inicio/06-festejo-en-la-pista.jpg",
    alt: "Un grupo de invitados festeja y señala la pantalla desde la pista de baile",
    duplicada: false,
  },
  {
    src: "/inicio/07-egreso-escolar.jpg",
    alt: "Dos compañeras de egreso escolar miran juntas las fotos en el celular",
    duplicada: false,
  },
];

/**
 * Devuelve la lista repetida `COPIAS_DEL_BUCLE` veces.
 *
 * La primera copia es la real; las demás van marcadas para poder ocultarlas del
 * lector de pantalla, que si no anuncia la misma lista una vez por copia.
 */
export function duplicarParaBucle(
  fotos: readonly FotoInicio[],
  copias: number = COPIAS_DEL_BUCLE,
): readonly FotoInicio[] {
  return Array.from({ length: copias }, (_, i) =>
    i === 0 ? fotos : fotos.map((foto) => ({ ...foto, duplicada: true })),
  ).flat();
}
