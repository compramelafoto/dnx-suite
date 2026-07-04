/**
 * Helpers para el panel de administración
 */

/**
 * Formatea un monto en pesos (ARS) con formato local
 */
export function formatARS(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "$0";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Formatea una fecha a formato local argentino
 */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "N/A";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("es-AR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Argentina/Buenos_Aires",
  });
}

/**
 * Formatea una fecha solo con fecha (sin hora)
 */
export function formatDateOnly(date: Date | string | null | undefined): string {
  if (!date) return "N/A";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("es-AR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "America/Argentina/Buenos_Aires",
  });
}

/**
 * Obtiene el color del badge según el estado
 */
export function getStatusBadgeColor(status: string): string {
  const colors: Record<string, string> = {
    // PrintOrderStatus
    CREATED: "bg-gray-100 text-gray-800",
    IN_PRODUCTION: "bg-blue-100 text-blue-800",
    READY: "bg-yellow-100 text-yellow-800",
    READY_TO_PICKUP: "bg-green-100 text-green-800",
    SHIPPED: "bg-purple-100 text-purple-800",
    DELIVERED: "bg-green-100 text-green-800",
    CANCELED: "bg-red-100 text-red-800",
    // PrintOrderPaymentStatus
    PENDING: "bg-yellow-100 text-yellow-800",
    PAID: "bg-green-100 text-green-800",
    FAILED: "bg-red-100 text-red-800",
    REFUNDED: "bg-gray-100 text-gray-800",
    // LabApprovalStatus
    APPROVED: "bg-green-100 text-green-800",
    REJECTED: "bg-red-100 text-red-800",
    // SupportTicketStatus
    OPEN: "bg-blue-100 text-blue-800",
    IN_PROGRESS: "bg-yellow-100 text-yellow-800",
    RESOLVED: "bg-green-100 text-green-800",
    CLOSED: "bg-gray-100 text-gray-800",
  };
  return colors[status] || "bg-gray-100 text-gray-800";
}

/**
 * Obtiene el label legible de un estado
 */
export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    // PrintOrderStatus
    CREATED: "Creado",
    IN_PRODUCTION: "En Producción",
    READY: "Listo",
    READY_TO_PICKUP: "Listo para Retirar",
    SHIPPED: "Enviado",
    DELIVERED: "Entregado",
    CANCELED: "Cancelado",
    // PrintOrderPaymentStatus
    PENDING: "Pendiente",
    PAID: "Pagado",
    FAILED: "Fallido",
    REFUNDED: "Reembolsado",
    // LabApprovalStatus (PENDING ya está definido arriba, pero estos son específicos)
    APPROVED: "Aprobado",
    REJECTED: "Rechazado",
    // SupportTicketStatus
    OPEN: "Abierto",
    IN_PROGRESS: "En Proceso",
    RESOLVED: "Resuelto",
    CLOSED: "Cerrado",
  };
  return labels[status] || status;
}

/**
 * Obtiene el label legible de un rol
 */
export function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    ADMIN: "Administrador",
    PHOTOGRAPHER: "Fotógrafo",
    LAB_PHOTOGRAPHER: "Lab + Fotógrafo",
    LAB: "Laboratorio",
    CUSTOMER: "Cliente",
    ORGANIZER: "Organizador",
  };
  return labels[role] || role;
}

/**
 * Obtiene el label legible del tipo de pedido
 */
export function getOrderTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    DIGITAL: "Digital",
    PRINT: "Impresión",
    COMBO: "Mixto",
  };
  return labels[type] || type;
}
