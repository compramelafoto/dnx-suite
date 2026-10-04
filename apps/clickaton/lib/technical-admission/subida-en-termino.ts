/**
 * ¿Esta foto se subió en término?
 *
 * Parece obvio y no lo era: la admisión preguntaba *"¿estamos ahora dentro de
 * la ventana de entrega?"* en vez de *"¿esta foto se subió dentro de la
 * ventana?"*. Como la revisión se hace cuando la maratón ya terminó, la
 * respuesta era siempre que no, y **100 fotos entregadas a tiempo quedaron
 * rechazadas por llegar tarde**. Las 270 de la edición Argentina 2026 se
 * habían subido en término.
 *
 * La diferencia es entre una pregunta sobre el hecho —que no cambia— y una
 * sobre el momento en que se mira. La admisión es un juicio sobre lo que pasó;
 * el reloj de hoy no puede formar parte de él.
 *
 * La ventana se guarda en el propio envío cuando la foto entra, así que la
 * decisión es exacta y reproducible: da lo mismo revisar hoy que dentro de un
 * año, y cambiar el cronograma después no reescribe la historia.
 */

export type EnvioParaVentana = {
  /** Cuándo entró la foto. */
  subidaEn: Date | null;
  /** La ventana que regía en ese momento, guardada junto al envío. */
  ventanaDesde: Date | null;
  ventanaHasta: Date | null;
};

export type ResultadoDeVentana = {
  /** `null` cuando no hay con qué decidir: no es ni sí ni no. */
  enTermino: boolean | null;
  motivo:
    | "EN_TERMINO"
    | "LLEGO_ANTES"
    | "LLEGO_TARDE"
    | "SIN_VENTANA"
    | "SIN_FECHA_DE_SUBIDA";
};

/**
 * El final es exclusivo: a la hora exacta de cierre ya no se entra.
 *
 * Es la misma regla que aplica la pantalla de subida, y tienen que coincidir:
 * si una dejara entrar lo que la otra rechaza, alguien subiría una foto y la
 * perdería después sin entender por qué.
 */
export function revisarSubidaEnTermino(envio: EnvioParaVentana): ResultadoDeVentana {
  if (!envio.subidaEn) {
    return { enTermino: null, motivo: "SIN_FECHA_DE_SUBIDA" };
  }
  if (!envio.ventanaDesde) {
    // Sin ventana configurada no hay nada que incumplir. Decir que no está en
    // término sería inventar una regla que nadie fijó.
    return { enTermino: null, motivo: "SIN_VENTANA" };
  }

  const subida = envio.subidaEn.getTime();

  if (subida < envio.ventanaDesde.getTime()) {
    return { enTermino: false, motivo: "LLEGO_ANTES" };
  }
  if (envio.ventanaHasta && subida >= envio.ventanaHasta.getTime()) {
    return { enTermino: false, motivo: "LLEGO_TARDE" };
  }
  return { enTermino: true, motivo: "EN_TERMINO" };
}
