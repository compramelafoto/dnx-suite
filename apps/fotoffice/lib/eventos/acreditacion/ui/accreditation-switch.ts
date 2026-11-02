/**
 * Interruptor del módulo de acreditación.
 *
 * Copiado de Clickatón. Allá la "ventana" es el horario de acreditación del
 * cronograma; en FOTOFFICE es el día del evento (entre la fecha de inicio y la
 * de fin). El interruptor no se prende solo: hay que encenderlo a mano, y nace
 * apagado.
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
      estado: "Acreditación apagada",
      explicacion: ventanaAbierta
        ? "El evento ya empezó, pero la acreditación está apagada: el escáner rechaza todas las credenciales con un cartel de módulo deshabilitado."
        : "La acreditación está apagada. Aunque llegue el día del evento, el escáner no va a dejar pasar a nadie: encendela antes de que abra la puerta.",
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
    estado: "Acreditación encendida",
    explicacion: ventanaAbierta
      ? "La acreditación está encendida y el evento está en curso: el escáner puede registrar ingresos."
      : "La acreditación está encendida. Cuando llegue el día del evento, el escáner registra los ingresos.",
    tono: "success",
    pideConfirmacion: durante,
    textoDeConfirmacion: durante
      ? ingresosRegistrados > 0
        ? `Ya hay ${ingresosRegistrados} ${ingresosRegistrados === 1 ? "persona acreditada" : "personas acreditadas"}. Si apagás la acreditación, el escáner deja de dejar pasar a todo el mundo. ¿Seguro?`
        : "El evento está en curso. Si apagás la acreditación, el escáner deja de dejar pasar a todo el mundo. ¿Seguro?"
      : null,
  };
}
