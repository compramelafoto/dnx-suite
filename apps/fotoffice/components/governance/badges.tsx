import { projectStatusLabel, projectStatusTone, taskStatusLabel, urgencyLabel } from "@/lib/governance/labels";
import type { Urgency } from "@/lib/governance/urgency";
import { Archive, Ban, Check, CheckCheck, Clock, Inbox, MessagesSquare, Play, X, type LucideIcon } from "lucide-react";

/** El ícono de cada estado: ✓ y ✗ para lo que se decidió, un reloj para lo postergado. */
export const STATUS_ICON: Record<string, LucideIcon> = {
  MEMBER_PROPOSAL: Inbox,
  PROPOSED: MessagesSquare,
  IN_REVIEW: MessagesSquare,
  POSTPONED: Clock,
  APPROVED: Check,
  IN_PROGRESS: Play,
  DONE: CheckCheck,
  REJECTED: X,
  CANCELLED: Ban,
  ARCHIVED: Archive,
};

/** Pastillas de estado y urgencia del módulo de proyectos. Sólo tokens del sistema de diseño. */

const TONO: Record<string, string> = {
  neutral: "bg-[var(--fo-surface-muted)] text-[var(--fo-text-secondary)]",
  info: "bg-[var(--fo-accent-muted)] text-[var(--fo-accent)]",
  success: "bg-[var(--fo-success-soft)] text-[var(--fo-success)]",
  warning: "bg-[var(--fo-warning-soft)] text-[var(--fo-warning)]",
  danger: "bg-[var(--fo-danger-soft)] text-[var(--fo-danger)]",
};

const pastilla = "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium";

export function ProjectStatusBadge({ status, size = "sm" }: { status: string; size?: "sm" | "lg" }) {
  const Icono = STATUS_ICON[status];
  const grande = size === "lg" ? "gap-1.5 px-3 py-1 text-sm" : "gap-1";
  return (
    <span className={`${pastilla} ${grande} ${TONO[projectStatusTone(status)]}`}>
      {Icono ? <Icono className={size === "lg" ? "size-4" : "size-3"} aria-hidden strokeWidth={2.5} /> : null}
      {projectStatusLabel(status)}
    </span>
  );
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
