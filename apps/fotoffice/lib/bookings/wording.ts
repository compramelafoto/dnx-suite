/**
 * Cómo habla la agenda pública.
 *
 * Reservas nació para alquilar salas por hora (el estudio y el salón de la SFPR), y sus textos
 * lo decían: "Alquilar un espacio", "Volver a los espacios". En una barbería lo que se reserva
 * es un turno con una persona, y esos textos no tenían sentido. El tipo de agenda decide el tono
 * y la institución puede ponerle nombre a lo que se reserva ("barbero").
 */

export const AGENDA_KINDS = ["ESPACIOS", "PROFESIONALES"] as const;
export type AgendaKind = (typeof AGENDA_KINDS)[number];

export function normalizeAgendaKind(raw: string | null | undefined): AgendaKind {
  return raw === "PROFESIONALES" ? "PROFESIONALES" : "ESPACIOS";
}

export type BookingWording = {
  kind: AgendaKind;
  singular: string;
  plural: string;
  /** Título de la página pública de reservas. */
  pageTitle: string;
  /** Lo que dice la lista cuando no hay nada para reservar. */
  emptyText: string;
  /** El enlace para volver a la lista desde el calendario. */
  backLabel: string;
  /** El botón de cada tarjeta de la lista. */
  bookLabel: string;
};

export function bookingWording(input: {
  agendaKind?: string | null;
  resourceSingular?: string | null;
  resourcePlural?: string | null;
}): BookingWording {
  const kind = normalizeAgendaKind(input.agendaKind);
  const defectoSingular = kind === "PROFESIONALES" ? "profesional" : "espacio";
  const defectoPlural = kind === "PROFESIONALES" ? "profesionales" : "espacios";
  const singular = input.resourceSingular?.trim().toLowerCase() || defectoSingular;
  // Si cargaron sólo el singular, el plural se arma con una "s": alcanza para "barbero".
  const plural =
    input.resourcePlural?.trim().toLowerCase() ||
    (input.resourceSingular?.trim() ? `${singular}s` : defectoPlural);

  if (kind === "PROFESIONALES") {
    return {
      kind,
      singular,
      plural,
      pageTitle: "Reservá tu turno",
      emptyText: `Por ahora no hay ${plural} con turnos disponibles.`,
      backLabel: `Elegir otro ${singular}`,
      bookLabel: "Ver turnos",
    };
  }
  return {
    kind,
    singular,
    plural,
    pageTitle: `Alquilar un ${singular}`,
    emptyText: `Por ahora no hay ${plural} disponibles para alquilar.`,
    backLabel: `Volver a los ${plural}`,
    bookLabel: "Reservar",
  };
}
