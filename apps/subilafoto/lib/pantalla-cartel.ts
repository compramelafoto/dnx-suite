import type { MomentoEvento } from "./acceso-evento";

/**
 * Qué muestra la pantalla del salón según el momento del evento.
 *
 * Hay **tres** momentos, no dos. La pantalla decidía mirando `puedeSubir`, que es falso
 * tanto antes de que el evento arranque como después de que termina: enchufar el
 * televisor media hora antes mostraba "Gracias por la noche" a un salón que recién se
 * estaba llenando.
 */

export type Cartel =
  | { tipo: "ESPERANDO"; titulo: string; bajada: string }
  | { tipo: "PROYECTANDO" }
  | { tipo: "CIERRE"; titulo: string };

const CIERRE_POR_DEFECTO = "Gracias por la noche";

export function cartelDePantalla(entrada: {
  momento: MomentoEvento;
  /** `closingCardText` del evento. Es una despedida: no se usa antes de empezar. */
  textoDeCierre: string | null;
}): Cartel {
  if (entrada.momento === "ABIERTO") return { tipo: "PROYECTANDO" };

  if (entrada.momento === "ANTES") {
    /*
      La carga todavía está cerrada: quien escanee ahora va a leer "todavía no arrancó".
      Decirle "subí tus fotos" sería mandarlo a una puerta con llave. Lo que sí vale
      hacer en este momento —y es lo que ofrece esa pantalla— es guardar el código.
    */
    return {
      tipo: "ESPERANDO",
      titulo: "Ya podés ir sacando fotos",
      bajada: "Escaneá el código y guardalo. Cuando arranque, subilas y aparecen acá.",
    };
  }

  return {
    tipo: "CIERRE",
    titulo: entrada.textoDeCierre?.trim() || CIERRE_POR_DEFECTO,
  };
}
