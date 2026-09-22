import type { ClickatonRegistrationStatus } from "@/lib/registration/domain/types";

/**
 * Un regalo comprado y todavía sin activar es la única inscripción que está
 * **paga y sin participante**: los datos que tiene son los de quien la compró.
 * Mostrarla en el listado como una inscripción cualquiera hace creer que esa
 * persona va a participar, y no es así — puede incluso estar inscripta aparte
 * con su propio lugar.
 */
export function esFilaDeRegaloSinActivar(row: {
  status: ClickatonRegistrationStatus | string;
}): boolean {
  return row.status === "GIFT_AWAITING_REDEMPTION";
}

export type AdminParticipantIdentity = {
  /** Lo que se muestra como nombre de la fila. */
  displayName: string;
  /** Aclaración debajo del nombre, o null si no hace falta ninguna. */
  note: string | null;
  /** true cuando el nombre mostrado NO es el de quien va a participar. */
  awaitingParticipant: boolean;
};

export function presentAdminParticipantIdentity(row: {
  status: ClickatonRegistrationStatus | string;
  firstName: string | null | undefined;
  lastName: string | null | undefined;
  email: string | null | undefined;
}): AdminParticipantIdentity {
  const fullName = [row.firstName, row.lastName]
    .map((part) => (part ?? "").trim())
    .filter(Boolean)
    .join(" ");

  if (!esFilaDeRegaloSinActivar(row)) {
    return {
      displayName: fullName || (row.email ?? "").trim() || "Sin nombre",
      note: null,
      awaitingParticipant: false,
    };
  }

  // Quien compró queda nombrado, pero como comprador. Si no dejó nombre se
  // usa su email antes que inventar uno.
  const comprador = fullName || (row.email ?? "").trim();
  return {
    displayName: "A designar",
    note: comprador ? `Lo regaló ${comprador}` : "Regalo sin destinatario cargado",
    awaitingParticipant: true,
  };
}
