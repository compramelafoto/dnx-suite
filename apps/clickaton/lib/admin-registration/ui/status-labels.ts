import type {
  ClickatonHoldStatus,
  ClickatonPaymentStatus,
  ClickatonRegistrationStatus,
} from "@/lib/registration/domain/types";
import { formatArsDisplay } from "@/lib/admin-catalog/domain/money";

export function registrationStatusLabel(status: ClickatonRegistrationStatus): string {
  const map: Record<ClickatonRegistrationStatus, string> = {
    DRAFT: "Borrador",
    PENDING_PAYMENT: "Pago pendiente",
    CONFIRMED: "Confirmada",
    WAITLISTED: "Lista de espera",
    CANCELLED: "Cancelada",
    REFUNDED: "Reembolsada",
    DISQUALIFIED: "Descalificada",
  };
  return map[status] ?? status;
}

export function paymentStatusLabel(status: ClickatonPaymentStatus): string {
  const map: Record<ClickatonPaymentStatus, string> = {
    NOT_REQUIRED: "Pago no requerido",
    PENDING: "Cobro pendiente",
    PROCESSING: "Procesando cobro",
    APPROVED: "Cobro aprobado",
    FAILED: "Cobro fallido",
    EXPIRED: "Cobro expirado",
    CANCELLED: "Cobro cancelado",
    REFUNDED: "Cobro reembolsado",
    PARTIALLY_REFUNDED: "Reembolso parcial",
    MANUAL_REVIEW: "Revisión manual",
  };
  return map[status] ?? status;
}

export function holdStatusLabel(status: ClickatonHoldStatus): string {
  const map: Record<ClickatonHoldStatus, string> = {
    ACTIVE: "Reserva activa",
    CONSUMED: "Consumida",
    EXPIRED: "Expirada",
    RELEASED: "Liberada",
  };
  return map[status] ?? status;
}

export function registrationStatusTone(
  status: ClickatonRegistrationStatus,
): "success" | "warning" | "danger" | "neutral" | "brand" {
  if (status === "CONFIRMED") return "success";
  if (status === "PENDING_PAYMENT" || status === "WAITLISTED" || status === "DRAFT") {
    return "warning";
  }
  if (status === "CANCELLED" || status === "REFUNDED" || status === "DISQUALIFIED") {
    return "danger";
  }
  return "neutral";
}

export function displayRegistrationAmount(minor: number, currency = "ARS"): string {
  if (minor === 0) return "Gratis";
  return formatArsDisplay(minor, currency as "ARS");
}

export function formatArDateTime(date: Date | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

/** Máscara parcial de documento para listados. */
export function maskDocument(documentNumber: string | null | undefined): string {
  if (!documentNumber) return "—";
  const digits = documentNumber.replace(/\s+/g, "");
  if (digits.length <= 4) return "••••";
  return `••••${digits.slice(-4)}`;
}
