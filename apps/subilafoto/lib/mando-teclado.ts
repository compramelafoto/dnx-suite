/**
 * El mando del DJ, por teclado.
 *
 * **Por qué no hay botones en pantalla.** La botonera vivía en una pestaña del borde
 * izquierdo que decía "CONTROLES", y antes de eso en una franja invisible que no
 * encontraba nadie. Las dos versiones compartían el mismo problema: son píxeles
 * proyectados en la pared de una fiesta, al lado de las fotos, que nadie quiere ver.
 *
 * La pantalla del salón la maneja una notebook o un palo conectado al televisor, así que
 * hay teclado. Un atajo no ocupa lugar en la proyección y se toca sin mirar.
 *
 * **El precio**: sin teclado no hay control. Si el televisor se maneja sólo con control
 * remoto, la pantalla sigue andando sola —pasa fotos, intercala el QR— pero no se puede
 * pausar ni adelantar.
 */

export type AccionDeMando = "PAUSA" | "SIGUIENTE" | "AZAR";

export type TeclaRecibida = {
  tecla: string;
  /** Con Ctrl, Cmd o Alt la combinación es del navegador, no nuestra. */
  conModificador?: boolean;
  /** Si el foco está escribiendo en algún lado. En esta pantalla no debería, pero. */
  escribiendo?: boolean;
};

export function accionDeTecla(entrada: TeclaRecibida): AccionDeMando | null {
  if (entrada.conModificador || entrada.escribiendo) return null;

  switch (entrada.tecla) {
    // La barra espaciadora es la tecla de pausa de todo reproductor desde siempre.
    case " ":
    case "Spacebar":
      return "PAUSA";

    // La flecha, por lo mismo. La N es para el que maneja de memoria y a oscuras.
    case "ArrowRight":
    case "n":
    case "N":
      return "SIGUIENTE";

    case "a":
    case "A":
      return "AZAR";

    default:
      return null;
  }
}

/**
 * Qué cartelito mostrar después de la tecla.
 *
 * Sin botonera no hay nada en pantalla que diga en qué estado quedó: si apretar la barra
 * no avisa nada, el DJ no sabe si pausó, si la tecla no llegó o si el televisor se colgó.
 * El cartel es la única confirmación que queda, así que no es decoración.
 *
 * Recibe el estado **ya aplicado**, no el anterior: lo que se muestra es dónde quedó.
 */
export function avisoDeAccion(
  accion: AccionDeMando,
  estado: { pausado: boolean; aleatorio: boolean },
): string {
  switch (accion) {
    case "PAUSA":
      return estado.pausado ? "En pausa" : "Reanudado";
    case "AZAR":
      return estado.aleatorio ? "Pasa al azar" : "Pasa en orden";
    case "SIGUIENTE":
      return "Siguiente";
  }
}

/** Lo que dice el cartel de ayuda al abrir la pantalla, y con la tecla `?`. */
export const AYUDA_DEL_MANDO = "Espacio: pausa · →: siguiente · A: al azar";
