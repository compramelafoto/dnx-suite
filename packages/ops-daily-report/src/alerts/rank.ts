import type { AlertSeverity, AlertUrgency, ReportAlert } from "../contracts/alert";

/**
 * La urgencia se multiplica por un factor mayor que la gravedad a propósito:
 * algo gravísimo que puede esperar a la semana que viene no debe tapar algo
 * serio que hay que atender ahora mismo.
 */
const URGENCY_WEIGHT: Record<AlertUrgency, number> = {
  immediate: 400,
  today: 300,
  thisWeek: 200,
  informational: 100,
};

const SEVERITY_WEIGHT: Record<AlertSeverity, number> = {
  critical: 40,
  high: 30,
  medium: 20,
  low: 10,
};

export function alertScore(alert: ReportAlert): number {
  return URGENCY_WEIGHT[alert.urgency] + SEVERITY_WEIGHT[alert.severity];
}

export function rankAlerts(alerts: ReportAlert[]): ReportAlert[] {
  return [...alerts].sort((left, right) => {
    const byScore = alertScore(right) - alertScore(left);
    if (byScore !== 0) return byScore;

    const byCount = (right.affectedCount ?? 0) - (left.affectedCount ?? 0);
    if (byCount !== 0) return byCount;

    return left.id.localeCompare(right.id);
  });
}
