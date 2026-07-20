import { displayTicketPrice } from "@/lib/admin-catalog/ui/money-ui";

export function formatPublicPrice(minor: number, currency = "ARS"): string {
  return displayTicketPrice(minor, currency as "ARS");
}

export function formatHoldExpiry(date: Date | null | undefined): string {
  if (!date) return "tiempo limitado";
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

export function kitKindLabel(kind: "entry" | "entry_product" | "kit"): string {
  if (kind === "kit") return "Kit";
  if (kind === "entry_product") return "Entrada + producto";
  return "Entrada";
}
