/**
 * Fechas para UI participante (es-AR). No corrige contradicciones documentadas.
 */

export function formatParticipantDate(
  value: Date | string | null | undefined,
  options?: { includeTime?: boolean; timeZone?: string | null },
): string | null {
  if (!value) return null;
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return null;

  const fmt: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "long",
    year: "numeric",
  };
  if (options?.includeTime) {
    fmt.hour = "2-digit";
    fmt.minute = "2-digit";
  }
  if (options?.timeZone) {
    fmt.timeZone = options.timeZone;
  }

  try {
    return new Intl.DateTimeFormat("es-AR", fmt).format(d);
  } catch {
    return new Intl.DateTimeFormat("es-AR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(d);
  }
}

export function formatParticipantDateShort(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}
