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
 * Obtiene la URL de soporte según el rol del solicitante.
 * Usado para links en emails de respuesta a incidencias.
 */
export function getSupportUrlForRole(requesterRole: string | null, ticketId?: number): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "https://compramelafoto.com";
  const baseUrl = base.replace(/\/$/, "");

  switch (requesterRole) {
    case "PHOTOGRAPHER":
    case "LAB_PHOTOGRAPHER":
      return `${baseUrl}/fotografo/soporte?tab=incidencias`;
    case "CUSTOMER":
    case "CLIENT":
      return `${baseUrl}/cliente/soporte`;
    case "LAB":
      return `${baseUrl}/lab/soporte`;
    case "ORGANIZER":
      return `${baseUrl}/organizador/soporte`;
    default:
      return `${baseUrl}/fotografo/soporte?tab=incidencias`;
  }
}
