export type PlatformKey =
  | "clf-monorepo"
  | "clf-legacy"
  | "clickaton"
  | "fotorank"
  | "infospot"
  | "fotoffice"
  /** Transversal a toda la suite. */
  | "platform";

export const PLATFORM_LABELS: Record<PlatformKey, string> = {
  "clf-monorepo": "ComprameLaFoto",
  "clf-legacy": "ComprameLaFoto (legacy)",
  clickaton: "Clickatón",
  fotorank: "FotoRank",
  infospot: "Info Spot",
  fotoffice: "FotOffice",
  platform: "Plataforma",
};

/** Cuánto duele si no se atiende. */
export type AlertSeverity = "critical" | "high" | "medium" | "low";

/** Cuánto puede esperar. */
export type AlertUrgency = "immediate" | "today" | "thisWeek" | "informational";

export type ReportAlert = {
  id: string;
  platform: PlatformKey;
  title: string;
  detail: string;
  severity: AlertSeverity;
  urgency: AlertUrgency;
  /** Cuántos casos abarca; null si no aplica. */
  affectedCount: number | null;
  /** ISO-8601 del caso más antiguo; null si no se conoce. */
  since: string | null;
  /** Enlace directo a la pantalla donde se resuelve. */
  actionUrl?: string;
};

export const SEVERITY_LABELS: Record<AlertSeverity, string> = {
  critical: "Crítica",
  high: "Alta",
  medium: "Media",
  low: "Baja",
};

export const URGENCY_LABELS: Record<AlertUrgency, string> = {
  immediate: "Atender ahora",
  today: "Atender hoy",
  thisWeek: "Esta semana",
  informational: "Informativa",
};
