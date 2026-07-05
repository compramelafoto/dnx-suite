export function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("es-AR", { dateStyle: "short" });
}

export function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("es-AR");
}

export function formatCurrencyArs(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPackPhase(value: "PRE_UPLOAD" | "POST_UPLOAD" | null): string {
  if (value === "PRE_UPLOAD") return "Antes de fotos";
  if (value === "POST_UPLOAD") return "Después de fotos";
  return "Sin fase";
}
