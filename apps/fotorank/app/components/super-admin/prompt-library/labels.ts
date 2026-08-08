import type {
  PhotoPromptDifficulty,
  PhotoPromptInspirationType,
  PhotoPromptStatus,
} from "@repo/photo-prompt-library";

export const STATUS_LABELS: Record<PhotoPromptStatus, string> = {
  DRAFT: "Borrador",
  IN_REVIEW: "En revisión",
  APPROVED: "Aprobada",
  REJECTED: "Rechazada",
  ARCHIVED: "Archivada",
};

export const DIFFICULTY_LABELS: Record<PhotoPromptDifficulty, string> = {
  EASY: "Fácil",
  MEDIUM: "Media",
  HARD: "Difícil",
};

export const INSPIRATION_TYPE_LABELS: Record<PhotoPromptInspirationType, string> = {
  DIRECTOR: "Director/a",
  MOVIE: "Película",
  GENRE: "Género",
  ART_MOVEMENT: "Movimiento artístico",
  PHOTOGRAPHER: "Fotógrafo/a",
  VISUAL_STYLE: "Estilo visual",
  OTHER: "Otra",
};

export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}
