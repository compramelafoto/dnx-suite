import type { ClaveCapa } from "./constantes";

/**
 * Lo que viaja del servidor a la pantalla de la Agenda. Sólo tipos y funciones puras (sin base): lo
 * importan componentes de cliente. Las fechas viajan como texto ISO.
 */

export type EventoVista = {
  id: string;
  capa: ClaveCapa;
  titulo: string;
  inicio: string;
  fin: string;
  todoElDia: boolean;
  color: string;
  href: string;
  editable: boolean;
};

export type ParticipanteDeCita = {
  id: string;
  userId: number | null;
  clientId: string | null;
  /** Nombre del contacto (sólo con Ver en Clientes); el del integrante lo pone la pantalla desde el equipo. */
  nombre: string | null;
  roleId: string | null;
  roleName: string | null;
};

export type OrigenDeCita = {
  tipo: "pedido" | "proyecto" | "consulta";
  id: string;
  etiqueta: string;
  /** null si quien mira no tiene Ver en el módulo de origen. */
  href: string | null;
};

export type DetalleCita = {
  id: string;
  title: string;
  typeId: string | null;
  status: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  location: string | null;
  notes: string | null;
  ownerUserId: number | null;
  clientId: string | null;
  /** null sin Ver en Clientes: la pantalla muestra «Contacto». */
  clientNombre: string | null;
  origen: OrigenDeCita[];
  participantes: ParticipanteDeCita[];
};

export type VistaDeAgenda = {
  eventos: EventoVista[];
  /** Capas que esta persona puede ver (y que se leyeron). */
  capas: ClaveCapa[];
  /** Capas que llegaron al tope y se cortaron. */
  truncadas: ClaveCapa[];
  citas: DetalleCita[];
};
