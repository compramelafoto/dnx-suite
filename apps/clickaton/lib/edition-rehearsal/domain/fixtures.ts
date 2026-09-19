/**
 * Ediciones de mentira para las pruebas del ensayo.
 *
 * Vive en `domain` y no en un archivo de test porque la usan tanto los tests
 * del chequeo como los de los atajos del reloj y el self-check del recorrido.
 */

import type { FotoDeEdicion } from "./types";

export const MOMENTO_DE_PRUEBA = new Date("2026-09-19T15:00:00.000Z");
export const COMIENZA = new Date("2026-10-10T19:00:00.000Z");
export const TERMINA = new Date("2026-10-10T23:00:00.000Z");
export const INSCRIPCION_ABRE = new Date("2026-09-01T12:00:00.000Z");
export const INSCRIPCION_CIERRA = new Date("2026-10-09T23:59:00.000Z");

/** Una edición bien configurada: ningún control debería quejarse. */
export function edicionSana(over: Partial<FotoDeEdicion> = {}): FotoDeEdicion {
  return {
    id: "ed1",
    slug: "clickaton-de-prueba",
    nombre: "Clickatón de prueba",
    publicada: true,
    inscripcionHabilitada: true,
    zonaHoraria: "America/Argentina/Buenos_Aires",
    comienzaEl: COMIENZA,
    terminaEl: TERMINA,
    inscripcionAbreEl: INSCRIPCION_ABRE,
    inscripcionCierraEl: INSCRIPCION_CIERRA,
    fasesDePrecio: [
      {
        id: "f1",
        nombre: "General",
        comienzaEl: INSCRIPCION_ABRE,
        terminaEl: INSCRIPCION_CIERRA,
      },
    ],
    entradas: [
      { id: "t1", nombre: "General", precio: 1_500_000, agotada: false, cupo: 300 },
    ],
    tieneCronogramaActivo: true,
    eventos: [
      { id: "e1", tipo: "MARATHON_START", comienzaEl: COMIENZA, estado: "SCHEDULED" },
      { id: "e2", tipo: "PROMPT_RELEASE", comienzaEl: COMIENZA, estado: "SCHEDULED" },
    ],
    consignas: [
      {
        id: "c1",
        estado: "READY",
        capturaAbreEl: COMIENZA,
        capturaCierraEl: new Date("2026-10-10T22:00:00.000Z"),
        subidaAbreEl: COMIENZA,
        subidaCierraEl: TERMINA,
      },
    ],
    acreditacionHabilitada: true,
    hayConfiguracionDeSubida: true,
    hayConfiguracionDeAdmision: true,
    mercadoPagoConectado: true,
    ...over,
  };
}

/** La rotura que ya pasó a un día del evento: las consignas quedaron en borrador. */
export function edicionConConsignasEnBorrador(): FotoDeEdicion {
  return edicionSana({
    consignas: edicionSana().consignas.map((c) => ({ ...c, estado: "DRAFT" as const })),
  });
}

/** La otra rotura conocida: se extendió la ventana y se olvidó la fase de precio. */
export function edicionConFaseDePrecioVencida(): FotoDeEdicion {
  return edicionSana({
    fasesDePrecio: [
      {
        id: "f1",
        nombre: "Anticipada",
        comienzaEl: INSCRIPCION_ABRE,
        terminaEl: new Date("2026-09-25T23:59:00.000Z"),
      },
    ],
  });
}
