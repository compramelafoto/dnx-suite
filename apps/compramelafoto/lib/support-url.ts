const SUPPORT_STATUS_LABELS: Record<string, string> = {
  OPEN: "Abierto",
  IN_PROGRESS: "En Proceso",
  RESOLVED: "Resuelto",
  CLOSED: "Cerrado",
};

export function getSupportStatusLabel(status: string): string {
  return SUPPORT_STATUS_LABELS[status] ?? status;
}

/**
 * Añade ?ticket= o &ticket= a una URL de panel de soporte (deep link).
 */
export function appendSupportTicketQuery(url: string, ticketId?: number): string {
  if (ticketId == null || !Number.isFinite(ticketId) || ticketId <= 0) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}ticket=${ticketId}`;
}

/**
 * Obtiene la URL de soporte según el rol del solicitante.
 * Usado para links en emails de respuesta a incidencias y notificaciones in-app.
 * @param ticketId Si se pasa, se añade ?ticket= (o &ticket=) para abrir la incidencia concreta.
 */
export function getSupportUrlForRole(requesterRole: string | null, ticketId?: number): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "https://compramelafoto.com";
  const baseUrl = base.replace(/\/$/, "");

  let path: string;
  switch (requesterRole) {
    case "PHOTOGRAPHER":
    case "LAB_PHOTOGRAPHER":
      path = `${baseUrl}/fotografo/soporte?tab=incidencias`;
      break;
    case "CUSTOMER":
    case "CLIENT":
      path = `${baseUrl}/cliente/soporte`;
      break;
    case "LAB":
      path = `${baseUrl}/lab/soporte`;
      break;
    case "ORGANIZER":
      path = `${baseUrl}/organizador/soporte`;
      break;
    default:
      path = `${baseUrl}/fotografo/soporte?tab=incidencias`;
      break;
  }

  return appendSupportTicketQuery(path, ticketId);
}
