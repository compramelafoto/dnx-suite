import { formatCuantoCobroCurrency } from "../calculate-cuanto-cobro";
import { formatQuoteStatusLabel } from "./quote-status-labels";
import type { CuantoCobroQuoteStatus } from "@prisma/client";

export function formatQuoteStatus(status: CuantoCobroQuoteStatus, archivedAt: string | null): string {
  return formatQuoteStatusLabel(status, archivedAt);
}

export function formatQuoteMoney(amount: number | null | undefined, currency: string): string {
  if (amount == null) return "—";
  return formatCuantoCobroCurrency(amount, currency || "ARS");
}

export function formatQuoteDate(value: string | null | undefined): string {
  if (!value) return "—";
  try {
    const [year, month, day] = value.split("-").map(Number);
    if (!year || !month || !day) return value;
    return new Date(year, month - 1, day).toLocaleDateString("es-AR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return value;
  }
}

/** Fecha compacta para tablas (una sola línea, sin scroll horizontal). */
export function formatQuoteDateCompact(value: string | null | undefined): string {
  if (!value) return "—";
  try {
    const [year, month, day] = value.split("-").map(Number);
    if (!year || !month || !day) return value;
    return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
  } catch {
    return value;
  }
}

export function formatQuoteDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("es-AR", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

export function formatQuoteRelativeTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "ahora";
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `hace ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `hace ${diffDays} d`;
  return formatQuoteDateTime(value);
}

export function formatQuoteClientLine(name: string, company: string): string {
  const trimmedName = name.trim();
  const trimmedCompany = company.trim();
  if (trimmedName && trimmedCompany) return `${trimmedName} · ${trimmedCompany}`;
  return trimmedName || trimmedCompany || "—";
}

export function formatQuoteJobType(value: string): string {
  const trimmed = value.trim();
  return trimmed || "—";
}

export function formatQuoteVersionLabel(versionNumber: number): string {
  return `V${versionNumber}`;
}
