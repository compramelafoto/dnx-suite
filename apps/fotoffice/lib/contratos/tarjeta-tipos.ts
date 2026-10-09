import type { EstadoContrato } from "./constantes";

/** Lo que muestran las tarjetas "Contratos" del pedido y del contacto. Sin texto ni datos de firma. */
export type ContratoDeTarjeta = {
  id: string;
  numero: string;
  nombre: string;
  estado: EstadoContrato;
  /** ISO. */
  creadoEn: string;
  /** Sólo en la tarjeta del contacto: a qué pedido pertenece. */
  pedido: { id: string; numero: string };
};
