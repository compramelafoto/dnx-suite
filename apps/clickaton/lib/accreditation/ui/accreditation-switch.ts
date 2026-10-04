/**
 * Interruptor del módulo de acreditación.
 *
 * Son dos cosas distintas y las dos tienen que estar bien para que el escáner
 * deje pasar a alguien: este interruptor y la ventana horaria del cronograma.
 * La ventana se abre sola a la hora cargada; el interruptor no: hay que
 * encenderlo a mano, y nace apagado.
 *
 * Función pura: decide qué mostrar y cuándo pedir confirmación, sin tocar la
 * base.
 */

export type EstadoDelInterruptor = {
  /** Qué hace el botón si lo aprietan. */
  accion: "ENCENDER" | "APAGAR";
  etiquetaDelBoton: string;
  /** Resumen corto del estado actual. */
  estado: string;
  /** Qué significa para la gente que está en la puerta. */
  explicacion: string;
  tono: "success" | "warning" | "danger";
  /** Apagar durante el evento no puede ser un clic al descuido. */
  pideConfirmacion: boolean;
  textoDeConfirmacion: string | null;
};

export function presentarInterruptorDeAcreditacion(input: {
  habilitado: boolean;
  ingresosRegistrados: number;
  ventanaAbierta: boolean;
}): EstadoDelInterruptor {
  const { habilitado, ingresosRegistrados, ventanaAbierta } = input;

  if (!habilitado) {
    return {
      accion: "ENCENDER",
      etiquetaDelBoton: "Encender la acreditación",
      estado: "Módulo apagado",
      explicacion: ventanaAbierta
        ? "El horario de acreditación ya está abierto, pero el módulo está apagado: el escáner rechaza todas las credenciales con un cartel de módulo deshabilitado."
        : "El módulo está apagado. Aunque llegue la hora de acreditar, el escáner no va a dejar pasar a nadie: encendelo antes de que abra la puerta.",
      tono: ventanaAbierta ? "danger" : "warning",
      // Encender es la acción segura: nunca frena a nadie.
      pideConfirmacion: false,
      textoDeConfirmacion: null,
    };
  }

  const durante = ventanaAbierta || ingresosRegistrados > 0;

  return {
    accion: "APAGAR",
    etiquetaDelBoton: "Apagar la acreditación",
    estado: "Módulo encendido",
    explicacion: ventanaAbierta
      ? "El módulo está encendido y el horario está abierto: el escáner puede registrar ingresos."
      : "El módulo está encendido. Cuando llegue la hora de acreditación, el escáner va a empezar a registrar ingresos solo.",
    tono: "success",
    pideConfirmacion: durante,
    textoDeConfirmacion: durante
      ? ingresosRegistrados > 0
        ? `Ya hay ${ingresosRegistrados} ${ingresosRegistrados === 1 ? "persona acreditada" : "personas acreditadas"}. Si apagás el módulo, el escáner deja de dejar pasar a todo el mundo. ¿Seguro?`
        : "El horario de acreditación está abierto. Si apagás el módulo, el escáner deja de dejar pasar a todo el mundo. ¿Seguro?"
      : null,
  };
}
