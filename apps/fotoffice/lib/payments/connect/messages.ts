import type { WorkspaceCollectionStatus } from "./status";

export type CollectionCopy = {
  title: string;
  body: string;
  /** Texto del botón, o null cuando no hay acción disponible. */
  actionLabel: string | null;
  tone: "neutral" | "ok" | "warn";
};

/**
 * Textos de la pantalla de cobros, en un solo lugar.
 *
 * Función pura para poder probar que cada estado dice lo que corresponde — sobre todo que
 * ninguno afirme que se puede cobrar cuando no se puede.
 */
export function collectionCopy(status: WorkspaceCollectionStatus): CollectionCopy {
  switch (status) {
    case "CONNECTED":
      return {
        title: "Cobros conectados",
        body: "Tu cuenta de MercadoPago está vinculada. Los pagos de tus socios entran directo a tu cuenta y la comisión de la plataforma se descuenta en la misma operación.",
        actionLabel: "Reconectar",
        tone: "ok",
      };
    case "AWAITING_CONSENT":
      return {
        title: "Falta autorizar el cobro dividido",
        body: "Tu cuenta está vinculada, pero MercadoPago todavía no registró tu autorización para recibir pagos divididos. Hasta que la otorgues no se pueden cobrar cuotas.",
        actionLabel: "Ver cómo autorizarlo",
        tone: "warn",
      };
    case "PENDING":
      return {
        title: "Vinculación incompleta",
        body: "Tu cuenta está vinculada pero todavía no quedó habilitada para recibir pagos divididos. Volvé a conectarla para terminar.",
        actionLabel: "Terminar de conectar",
        tone: "warn",
      };
    case "NEEDS_REAUTH":
      return {
        title: "Hay que reconectar",
        body: "El permiso que nos diste en MercadoPago venció o fue revocado. Hasta reconectar no se pueden cobrar cuotas.",
        actionLabel: "Reconectar",
        tone: "warn",
      };
    case "REVOKED":
      return {
        title: "Conexión revocada",
        body: "La vinculación con MercadoPago fue dada de baja. Podés volver a conectarla cuando quieras.",
        actionLabel: "Conectar de nuevo",
        tone: "warn",
      };
    case "NOT_CONNECTED":
    default:
      return {
        title: "Todavía no conectaste tus cobros",
        body: "Conectá tu cuenta de MercadoPago para poder cobrar cuotas. El dinero va directo a tu cuenta: la plataforma no lo recibe ni lo retiene.",
        actionLabel: "Conectar MercadoPago",
        tone: "neutral",
      };
  }
}

/** Mensajes de error que pueden llegar por query string desde las rutas OAuth. */
export function connectErrorMessage(code: string | null): string | null {
  if (!code) return null;
  switch (code) {
    case "cancelado":
      return "Cancelaste la autorización en MercadoPago. No se conectó nada.";
    case "sin_permiso":
      return "Solo el dueño o un administrador del workspace puede conectar los cobros.";
    case "NOT_CONFIGURED":
      return "La conexión con MercadoPago todavía no está configurada en la plataforma. Escribinos.";
    case "STATE_EXPIRED":
      return "El pedido de conexión venció. Probá de nuevo.";
    case "STATE_ALREADY_USED":
      return "Ese pedido de conexión ya se había usado. Empezá de nuevo.";
    case "STATE_NOT_FOUND":
    case "STATE_WRONG_PRODUCT":
    case "respuesta_incompleta":
      return "El pedido de conexión no es válido. Empezá de nuevo.";
    default:
      return "No se pudo completar la conexión. Probá de nuevo.";
  }
}
