import { randomBytes } from "node:crypto";

function pad(n: number, width: number): string {
  return String(n).padStart(width, "0");
}

function stamp(now: Date): string {
  const y = now.getUTCFullYear();
  const m = pad(now.getUTCMonth() + 1, 2);
  const d = pad(now.getUTCDate(), 2);
  const hh = pad(now.getUTCHours(), 2);
  const mm = pad(now.getUTCMinutes(), 2);
  const ss = pad(now.getUTCSeconds(), 2);
  const rand = randomBytes(3).toString("hex");
  return `${y}${m}${d}-${hh}${mm}${ss}-${rand}`;
}

/** Readable unique id: task-YYYYMMDD-HHMMSS-<rand> */
export function createTaskId(now: Date = new Date()): string {
  return `task-${stamp(now)}`;
}

export function createStageId(taskId: string, stageNumber: number): string {
  return `${taskId}-stage-${pad(stageNumber, 3)}`;
}

export function createPlanningRunId(now: Date = new Date()): string {
  return `plan-${stamp(now)}`;
}

export function createCursorRunId(now: Date = new Date()): string {
  return `crun-${stamp(now)}`;
}

export function createReviewRunId(now: Date = new Date()): string {
  return `rrev-${stamp(now)}`;
}

export function createValidationRunId(now: Date = new Date()): string {
  return `vrun-${stamp(now)}`;
}

export function createTaskRunId(now: Date = new Date()): string {
  return `trun-${stamp(now)}`;
}

export function createRunEventId(now: Date = new Date()): string {
  return `evt-${stamp(now)}`;
}

export function createApprovalRequestId(now: Date = new Date()): string {
  return `apr-${stamp(now)}`;
}
