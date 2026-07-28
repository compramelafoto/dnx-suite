export type SchedulePlan =
  | { mode: "IMMEDIATE"; scheduleAt: Date }
  | { mode: "SCHEDULED"; scheduleAt: Date };

export function planSchedule(input?: {
  scheduleAt?: Date | string | null;
  now?: Date;
}): SchedulePlan {
  const now = input?.now ?? new Date();
  if (!input?.scheduleAt) {
    return { mode: "IMMEDIATE", scheduleAt: now };
  }
  const at = new Date(input.scheduleAt);
  if (!Number.isFinite(at.getTime())) {
    throw new Error("SCHEDULE_INVALID");
  }
  if (at.getTime() <= now.getTime()) {
    return { mode: "IMMEDIATE", scheduleAt: now };
  }
  return { mode: "SCHEDULED", scheduleAt: at };
}

export function isDue(scheduleAt: Date | string | null | undefined, now = new Date()): boolean {
  if (!scheduleAt) return true;
  return new Date(scheduleAt).getTime() <= now.getTime();
}

/** Backoff: 1m, 5m, 15m, 1h, luego null (manual). */
export function nextRetryAt(attemptCount: number, now = new Date()): Date | null {
  const delaysMs = [60_000, 300_000, 900_000, 3_600_000];
  const delay = delaysMs[attemptCount] ?? null;
  if (delay == null) return null;
  return new Date(now.getTime() + delay);
}

export function buildCaption(parts: {
  caption: string;
  hashtags?: string[];
  mentions?: string[];
}): string {
  const lines = [parts.caption.trim()];
  const mentions = (parts.mentions ?? [])
    .map((m) => (m.startsWith("@") ? m : `@${m}`))
    .filter(Boolean);
  if (mentions.length) lines.push(mentions.join(" "));
  const tags = (parts.hashtags ?? [])
    .map((t) => (t.startsWith("#") ? t : `#${t.replace(/^#+/, "")}`))
    .filter(Boolean);
  if (tags.length) lines.push(tags.join(" "));
  return lines.filter(Boolean).join("\n\n");
}
