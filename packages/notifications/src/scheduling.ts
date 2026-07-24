/**
 * Programación de envíos.
 * En esta etapa solo se prepara el contrato; sin infra de cron genérico
 * el envío se encola como PENDING inmediato (scheduledAt = now).
 */

export type SchedulePlan =
  | { mode: "IMMEDIATE"; scheduledAt: Date }
  | { mode: "SCHEDULED"; scheduledAt: Date };

export function planSchedule(input?: {
  scheduledAt?: Date | string | null;
  now?: Date;
}): SchedulePlan {
  const now = input?.now ?? new Date();
  if (!input?.scheduledAt) {
    return { mode: "IMMEDIATE", scheduledAt: now };
  }
  const at = new Date(input.scheduledAt);
  if (!Number.isFinite(at.getTime())) {
    throw new Error("Fecha de programación inválida.");
  }
  if (at.getTime() <= now.getTime()) {
    return { mode: "IMMEDIATE", scheduledAt: now };
  }
  return { mode: "SCHEDULED", scheduledAt: at };
}

export function isDue(scheduledAt: Date | string, now: Date = new Date()): boolean {
  return new Date(scheduledAt).getTime() <= now.getTime();
}
