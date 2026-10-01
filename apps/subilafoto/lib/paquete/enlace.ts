/**
 * El enlace con el que el cliente baja su paquete.
 *
 * Tiene tres propiedades y las tres importan por motivos distintos:
 *
 * - **Vence.** Un enlace eterno es una copia de las fotos de una fiesta circulando para
 *   siempre por WhatsApp.
 * - **Se puede revocar.** Si el cliente avisa que lo compartió de más, se corta sin tocar
 *   nada más y sin borrarle el paquete.
 * - **No dice nada de sí mismo.** El identificador es opaco: no lleva el evento ni el
 *   cliente, así que no se puede adivinar el de otro.
 *
 * La decisión de si un enlace sirve es pura y se prueba acá; el resto es leer la base.
 */

/** Cuánto vive un enlace. Siete días alcanzan de sobra y no lo dejan eterno. */
export const DURACION_DEL_ENLACE_MS = 7 * 24 * 60 * 60 * 1000;

export type EstadoDelPaquete = {
  status: string;
  tokenExpiresAt: Date | null;
  /** Hasta cuándo se conserva el material del evento. */
  retentionUntil: Date | null;
  storageKey: string | null;
};

export type Veredicto =
  | { sirve: true; clave: string }
  | { sirve: false; motivo: string; vencido: boolean };

export function revisarEnlace(paquete: EstadoDelPaquete | null, ahora: Date): Veredicto {
  if (!paquete) {
    return { sirve: false, motivo: "Este enlace no existe o fue dado de baja.", vencido: false };
  }

  if (paquete.status === "EXPIRED" || paquete.status === "PURGED") {
    return {
      sirve: false,
      motivo: "Este paquete ya se borró. El material se conserva 30 días.",
      vencido: true,
    };
  }

  if (paquete.status === "QUEUED" || paquete.status === "BUILDING") {
    return {
      sirve: false,
      motivo: "Estamos armando tu paquete. Te avisamos por correo cuando esté listo.",
      vencido: false,
    };
  }

  if (paquete.status === "FAILED") {
    return {
      sirve: false,
      motivo: "No pudimos armar tu paquete. Ya estamos viéndolo: escribinos si no tenés noticias.",
      vencido: false,
    };
  }

  if (paquete.status !== "READY" || !paquete.storageKey) {
    return { sirve: false, motivo: "Este paquete todavía no está disponible.", vencido: false };
  }

  /*
    Vencido, no roto. El criterio del backlog es explícito: el enlace vencido tiene que
    mostrar un mensaje claro y no un error. Quien lo abre ya pagó — merece saber que puede
    pedir uno nuevo, no un 404.
  */
  if (paquete.tokenExpiresAt && ahora.getTime() >= paquete.tokenExpiresAt.getTime()) {
    return {
      sirve: false,
      motivo: "Este enlace venció. Pedí uno nuevo desde tu panel: el paquete sigue estando.",
      vencido: true,
    };
  }

  // Aunque el enlace siga vigente, si el material ya se borró no hay nada que bajar.
  if (paquete.retentionUntil && ahora.getTime() >= paquete.retentionUntil.getTime()) {
    return {
      sirve: false,
      motivo: "Este paquete ya se borró. El material se conserva 30 días.",
      vencido: true,
    };
  }

  return { sirve: true, clave: paquete.storageKey };
}

/** Hasta cuándo vale un enlace nuevo, sin pasarse del borrado del material. */
export function vencimientoDelEnlace(ahora: Date, retentionUntil: Date | null): Date {
  const propuesto = new Date(ahora.getTime() + DURACION_DEL_ENLACE_MS);
  // No tiene sentido prometer siete días si el material se borra en dos.
  if (retentionUntil && retentionUntil.getTime() < propuesto.getTime()) return retentionUntil;
  return propuesto;
}
