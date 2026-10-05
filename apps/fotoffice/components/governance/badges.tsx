import { projectStatusLabel, projectStatusTone, taskStatusLabel, urgencyLabel } from "@/lib/governance/labels";
import type { Urgency } from "@/lib/governance/urgency";

/** Pastillas de estado y urgencia del módulo de proyectos. Sólo tokens del sistema de diseño. */

const TONO: Record<string, string> = {
  neutral: "bg-[var(--fo-surface-muted)] text-[var(--fo-text-secondary)]",
  info: "bg-[var(--fo-accent-muted)] text-[var(--fo-accent)]",
  success: "bg-[var(--fo-success-soft)] text-[var(--fo-success)]",
  warning: "bg-[var(--fo-warning-soft)] text-[var(--fo-warning)]",
  danger: "bg-[var(--fo-danger-soft)] text-[var(--fo-danger)]",
};

const pastilla = "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium";

export function ProjectStatusBadge({ status }: { status: string }) {
  return <span className={`${pastilla} ${TONO[projectStatusTone(status)]}`}>{projectStatusLabel(status)}</span>;
}

const TONO_TAREA: Record<string, string> = {
  PENDING: TONO.neutral!,
  IN_PROGRESS: TONO.info!,
  DONE: TONO.success!,
  NOT_DONE: TONO.danger!,
};

export function TaskStatusBadge({ status }: { status: string }) {
  return <span className={`${pastilla} ${TONO_TAREA[status] ?? TONO.neutral}`}>{taskStatusLabel(status)}</span>;
}

const PUNTO: Record<Urgency, string> = {
  red: "bg-[var(--fo-danger)]",
  yellow: "bg-[var(--fo-warning)]",
  green: "bg-[var(--fo-success)]",
  gray: "bg-[var(--fo-border-strong)]",
};

export function UrgencyDot({ urgency }: { urgency: Urgency }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-[var(--fo-muted)]" title={urgencyLabel(urgency)}>
      <span className={`inline-block size-2.5 rounded-full ${PUNTO[urgency]}`} aria-hidden />
      {urgencyLabel(urgency)}
    </span>
  );
}

export function ProgressBar({ closed, total }: { closed: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((closed / total) * 100);
  return (
    <div className="flex items-center gap-2" title={`${closed} de ${total} tareas cerradas`}>
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-[var(--fo-surface-muted)]">
        <div className="h-full rounded-full bg-[var(--fo-accent)]" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums text-[var(--fo-muted)]">
        {closed}/{total}
      </span>
    </div>
  );
}
