import { claseDeColorEtiqueta } from "@/lib/ficha/formato";
import type { EstadoContrato } from "./constantes";

/** Color del chip de estado de un contrato (puro: lo usan la lista, la ficha y las tarjetas). */
const COLOR_ESTADO: Record<EstadoContrato, string> = {
  BORRADOR: "gris",
  ENVIADO: "azul",
  FIRMADO_PARCIAL: "amarillo",
  FIRMADO: "verde",
  RECHAZADO: "rojo",
  ANULADO: "gris",
};

export function claseDeEstadoContrato(e: EstadoContrato): string {
  return claseDeColorEtiqueta(COLOR_ESTADO[e]);
}
