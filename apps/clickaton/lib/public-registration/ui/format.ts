import { displayTicketPrice } from "@/lib/admin-catalog/ui/money-ui";
import { fechaHoraAr } from "@/lib/fecha-ar";

export function formatPublicPrice(minor: number, currency = "ARS"): string {
  return displayTicketPrice(minor, currency as "ARS");
}

/** El reloj de la reserva es hora argentina, y en 24 horas para que no se lea al revés. */
export function formatHoldExpiry(date: Date | null | undefined): string {
  return fechaHoraAr(date, null, "tiempo limitado");
}

export function kitKindLabel(kind: "entry" | "entry_product" | "kit"): string {
  if (kind === "kit") return "Kit";
  if (kind === "entry_product") return "Entrada + producto";
  return "Entrada";
}
