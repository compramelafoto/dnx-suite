import type { ProjectStatus, TaskStatus } from "./constants";
import { isClosed } from "./lifecycle";

/**
 * Urgencia por fecha límite y avance (diseño §5.3 y §7).
 *
 * Módulo PURO: recibe `now` para que las pruebas no dependan del reloj.
 */

export type Urgency = "red" | "yellow" | "green" | "gray";

const DIA_MS = 24 * 60 * 60 * 1000;

/** Rojo: vencida o a menos de 15 días. Amarillo: 15 a 45. Verde: más de 45. Gris: sin fecha. */
export function urgencyFor(deadlineAt: Date | null, now: Date): Urgency {
  if (!deadlineAt) return "gray";
  const dias = (deadlineAt.getTime() - now.getTime()) / DIA_MS;
  if (dias < 15) return "red";
  if (dias <= 45) return "yellow";
  return "green";
}

const PESO: Record<Urgency, number> = { red: 0, yellow: 1, green: 2, gray: 3 };

/**
 * Lista de prioridades: primero lo abierto, después por urgencia y, dentro del mismo color, por la
 * fecha más cercana. Con votación, el porcentaje a favor desempata dentro de cada color.
 */
export function sortByPriority<T extends { status: ProjectStatus; deadlineAt: Date | null; createdAt: Date }>(
  projects: readonly T[],
  now: Date,
  /** Porcentaje a favor de cada proyecto: dentro del mismo color, más apoyo va primero. */
  supportOf?: (p: T) => number,
): T[] {
  return projects.slice().sort((a, b) => {
    const cerradoA = isClosed(a.status) ? 1 : 0;
    const cerradoB = isClosed(b.status) ? 1 : 0;
    if (cerradoA !== cerradoB) return cerradoA - cerradoB;
    const ua = PESO[urgencyFor(a.deadlineAt, now)];
    const ub = PESO[urgencyFor(b.deadlineAt, now)];
    if (ua !== ub) return ua - ub;
    if (supportOf) {
      const sa = supportOf(a);
      const sb = supportOf(b);
      if (sa !== sb) return sb - sa;
    }
    if (a.deadlineAt && b.deadlineAt && a.deadlineAt.getTime() !== b.deadlineAt.getTime()) {
      return a.deadlineAt.getTime() - b.deadlineAt.getTime();
    }
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}

/** Una tarea está vencida si tiene fecha pasada y sigue abierta. */
export function isTaskOverdue(task: { status: TaskStatus; dueAt: Date | null }, now: Date): boolean {
  if (!task.dueAt) return false;
  if (task.status === "DONE" || task.status === "NOT_DONE") return false;
  return task.dueAt.getTime() < now.getTime();
}

export type Progress = { closed: number; total: number };

/** "Difusión 2/3": cuenta como cerrada la hecha y la que no se hizo (con motivo). */
export function progressOf(tasks: readonly { status: TaskStatus }[]): Progress {
  const closed = tasks.filter((t) => t.status === "DONE" || t.status === "NOT_DONE").length;
  return { closed, total: tasks.length };
}

export function progressPercent(p: Progress): number {
  return p.total === 0 ? 0 : Math.round((p.closed / p.total) * 100);
}
