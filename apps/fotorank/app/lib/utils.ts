const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  SETUP_IN_PROGRESS: "En configuración",
  READY_TO_PUBLISH: "Listo para publicar",
  PUBLISHED: "Publicado",
  CLOSED: "Cerrado",
  ARCHIVED: "Archivado",
  ACTIVE: "Publicado", // Legacy
};

export function formatContestStatus(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}
