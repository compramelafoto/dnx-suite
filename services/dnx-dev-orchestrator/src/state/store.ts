import { mkdir, readFile, rename, writeFile, readdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import {
  createApprovalRequestId,
  createCursorRunId,
  createPlanningRunId,
  createReviewRunId,
  createRunEventId,
  createStageId,
  createTaskId,
  createTaskRunId,
  createValidationRunId,
} from "./ids.js";
import type {
  ApprovalRequestRecord,
  CursorRunRecord,
  NextStageRecommendationRecord,
  PlanningRunRecord,
  RetryContext,
  ReviewRunRecord,
  RunEventRecord,
  Stage,
  StageStatus,
  Task,
  TaskRunRecord,
  TaskStatus,
  ValidationRunRecord,
} from "./types.js";
import type { StagePlan } from "../agents/planner/schema.js";

export type CreateTaskInput = {
  project: string;
  objective: string;
  budgetUsd: number;
  maxIterations: number;
  branch?: string | null;
  worktree?: string | null;
  status?: TaskStatus;
};

export class JsonTaskStore {
  constructor(private readonly dataDir: string) {}

  private tasksDir(): string {
    return join(this.dataDir, "tasks");
  }

  private planningRunsDir(): string {
    return join(this.dataDir, "planning-runs");
  }

  private cursorRunsDir(): string {
    return join(this.dataDir, "cursor-runs");
  }

  private reviewRunsDir(): string {
    return join(this.dataDir, "review-runs");
  }

  private validationRunsDir(): string {
    return join(this.dataDir, "validation-runs");
  }

  private taskRunsDir(): string {
    return join(this.dataDir, "task-runs");
  }

  private runEventsDir(): string {
    return join(this.dataDir, "run-events");
  }

  private approvalsDir(): string {
    return join(this.dataDir, "approvals");
  }

  private taskPath(taskId: string): string {
    return join(this.tasksDir(), `${taskId}.json`);
  }

  private planningRunPath(planningRunId: string): string {
    return join(this.planningRunsDir(), `${planningRunId}.json`);
  }

  private cursorRunPath(cursorRunId: string): string {
    return join(this.cursorRunsDir(), `${cursorRunId}.json`);
  }

  private reviewRunPath(reviewRunId: string): string {
    return join(this.reviewRunsDir(), `${reviewRunId}.json`);
  }

  private validationRunPath(validationRunId: string): string {
    return join(this.validationRunsDir(), `${validationRunId}.json`);
  }

  private taskRunPath(runId: string): string {
    return join(this.taskRunsDir(), `${runId}.json`);
  }

  private runEventPath(eventId: string): string {
    return join(this.runEventsDir(), `${eventId}.json`);
  }

  private approvalPath(approvalRequestId: string): string {
    return join(this.approvalsDir(), `${approvalRequestId}.json`);
  }

  async ensureReady(): Promise<void> {
    await mkdir(this.tasksDir(), { recursive: true });
    await mkdir(this.planningRunsDir(), { recursive: true });
    await mkdir(this.cursorRunsDir(), { recursive: true });
    await mkdir(this.reviewRunsDir(), { recursive: true });
    await mkdir(this.validationRunsDir(), { recursive: true });
    await mkdir(this.taskRunsDir(), { recursive: true });
    await mkdir(this.runEventsDir(), { recursive: true });
    await mkdir(this.approvalsDir(), { recursive: true });
  }

  async createTask(input: CreateTaskInput): Promise<Task> {
    await this.ensureReady();
    const now = new Date().toISOString();
    const task: Task = {
      taskId: createTaskId(),
      project: input.project.trim(),
      objective: input.objective.trim(),
      status: input.status ?? "PLANNING",
      currentStage: 0,
      iteration: 0,
      branch: input.branch ?? null,
      worktree: input.worktree ?? null,
      createdAt: now,
      updatedAt: now,
      budgetUsd: input.budgetUsd,
      spentUsd: 0,
      maxIterations: input.maxIterations,
      stages: [],
    };
    await this.writeTaskAtomic(task);
    return task;
  }

  async getTask(taskId: string): Promise<Task | null> {
    try {
      const raw = await readFile(this.taskPath(taskId), "utf8");
      return JSON.parse(raw) as Task;
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === "ENOENT") return null;
      throw error;
    }
  }

  async updateTask(
    taskId: string,
    patch: Omit<
      Partial<Task>,
      | "taskId"
      | "createdAt"
      | "lastError"
      | "lastPlanningRunId"
      | "lastCursorRunId"
      | "lastReviewRunId"
      | "lastTaskRunId"
      | "nextStageRecommendation"
      | "retryContext"
      | "stopReason"
    > & {
      lastError?: string | null;
      lastPlanningRunId?: string | null;
      lastCursorRunId?: string | null;
      lastReviewRunId?: string | null;
      lastTaskRunId?: string | null;
      nextStageRecommendation?: NextStageRecommendationRecord | null;
      retryContext?: RetryContext | null;
      stopReason?: string | null;
    },
  ): Promise<Task> {
    const existing = await this.getTask(taskId);
    if (!existing) {
      throw new Error(`Task not found: ${taskId}`);
    }

    const {
      lastError,
      lastPlanningRunId,
      lastCursorRunId,
      lastReviewRunId,
      lastTaskRunId,
      nextStageRecommendation,
      retryContext,
      stopReason,
      stages,
      ...rest
    } = patch;
    const next: Task = {
      ...existing,
      ...rest,
      taskId: existing.taskId,
      createdAt: existing.createdAt,
      stages: stages ?? existing.stages,
      updatedAt: new Date().toISOString(),
    };

    if (lastError === null) {
      delete next.lastError;
    } else if (typeof lastError === "string") {
      next.lastError = lastError;
    }

    if (lastPlanningRunId === null) {
      delete next.lastPlanningRunId;
    } else if (typeof lastPlanningRunId === "string") {
      next.lastPlanningRunId = lastPlanningRunId;
    }

    if (lastCursorRunId === null) {
      delete next.lastCursorRunId;
    } else if (typeof lastCursorRunId === "string") {
      next.lastCursorRunId = lastCursorRunId;
    }

    if (lastReviewRunId === null) {
      delete next.lastReviewRunId;
    } else if (typeof lastReviewRunId === "string") {
      next.lastReviewRunId = lastReviewRunId;
    }

    if (lastTaskRunId === null) {
      delete next.lastTaskRunId;
    } else if (typeof lastTaskRunId === "string") {
      next.lastTaskRunId = lastTaskRunId;
    }

    if (nextStageRecommendation === null) {
      delete next.nextStageRecommendation;
    } else if (nextStageRecommendation !== undefined) {
      next.nextStageRecommendation = nextStageRecommendation;
    }

    if (retryContext === null) {
      delete next.retryContext;
    } else if (retryContext !== undefined) {
      next.retryContext = retryContext;
    }

    if (stopReason === null) {
      delete next.stopReason;
    } else if (typeof stopReason === "string") {
      next.stopReason = stopReason;
    }

    await this.writeTaskAtomic(next);
    return next;
  }

  async listTasks(): Promise<Task[]> {
    await this.ensureReady();
    const entries = await readdir(this.tasksDir());
    const tasks: Task[] = [];
    for (const entry of entries) {
      if (!entry.endsWith(".json")) continue;
      const task = await this.getTask(entry.replace(/\.json$/, ""));
      if (task) tasks.push(task);
    }
    return tasks.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  findPendingStage(task: Task, stageNumber: number): Stage | undefined {
    return task.stages.find((s) => s.stageNumber === stageNumber && s.status === "PENDING");
  }

  async createStage(input: {
    taskId: string;
    title: string;
    prompt: string;
    status?: StageStatus;
    stageNumber?: number;
    planningRunId?: string;
    plan?: StagePlan;
    costUsd?: number;
  }): Promise<{ task: Task; stage: Stage } | { duplicate: true; stage: Stage; task: Task }> {
    const task = await this.getTask(input.taskId);
    if (!task) throw new Error(`Task not found: ${input.taskId}`);

    const stageNumber = input.stageNumber ?? task.stages.length + 1;
    const existingPending = this.findPendingStage(task, stageNumber);
    if (existingPending) {
      return { duplicate: true, stage: existingPending, task };
    }

    const stage: Stage = {
      stageId: createStageId(task.taskId, stageNumber),
      taskId: task.taskId,
      stageNumber,
      title: input.title,
      prompt: input.prompt,
      status: input.status ?? "PENDING",
      costUsd: input.costUsd ?? 0,
      ...(input.planningRunId ? { planningRunId: input.planningRunId } : {}),
      ...(input.plan ? { plan: input.plan } : {}),
    };

    const updated = await this.updateTask(task.taskId, {
      stages: [...task.stages, stage],
      currentStage: stageNumber,
    });
    return { task: updated, stage };
  }

  async getStagesForTask(taskId: string): Promise<Stage[]> {
    const task = await this.getTask(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);
    return [...task.stages];
  }

  async updateStage(taskId: string, stageId: string, patch: Partial<Stage>): Promise<Stage> {
    const task = await this.getTask(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);
    const idx = task.stages.findIndex((s) => s.stageId === stageId);
    if (idx < 0) throw new Error(`Stage not found: ${stageId}`);

    const current = task.stages[idx];
    if (!current) throw new Error(`Stage not found: ${stageId}`);

    const nextStage: Stage = {
      ...current,
      ...patch,
      stageId: current.stageId,
      taskId: current.taskId,
      stageNumber: current.stageNumber,
    };
    const stages = [...task.stages];
    stages[idx] = nextStage;
    await this.updateTask(taskId, { stages });
    return nextStage;
  }

  async savePlanningRun(run: Omit<PlanningRunRecord, "planningRunId" | "createdAt"> & {
    planningRunId?: string;
    createdAt?: string;
  }): Promise<PlanningRunRecord> {
    await this.ensureReady();
    const record: PlanningRunRecord = {
      ...run,
      planningRunId: run.planningRunId ?? createPlanningRunId(),
      createdAt: run.createdAt ?? new Date().toISOString(),
    };
    const target = this.planningRunPath(record.planningRunId);
    const temp = `${target}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(temp, `${JSON.stringify(record, null, 2)}\n`, "utf8");
    await rename(temp, target);
    return record;
  }

  async getPlanningRun(planningRunId: string): Promise<PlanningRunRecord | null> {
    try {
      const raw = await readFile(this.planningRunPath(planningRunId), "utf8");
      return JSON.parse(raw) as PlanningRunRecord;
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === "ENOENT") return null;
      throw error;
    }
  }

  async findStage(stageId: string): Promise<{ task: Task; stage: Stage } | null> {
    const tasks = await this.listTasks();
    for (const task of tasks) {
      const stage = task.stages.find((s) => s.stageId === stageId);
      if (stage) return { task, stage };
    }
    return null;
  }

  async saveCursorRun(
    run: Omit<CursorRunRecord, "cursorRunId" | "createdAt"> & {
      cursorRunId?: string;
      createdAt?: string;
    },
  ): Promise<CursorRunRecord> {
    await this.ensureReady();
    const record: CursorRunRecord = {
      ...run,
      cursorRunId: run.cursorRunId ?? createCursorRunId(),
      createdAt: run.createdAt ?? new Date().toISOString(),
    };
    const target = this.cursorRunPath(record.cursorRunId);
    const temp = `${target}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(temp, `${JSON.stringify(record, null, 2)}\n`, "utf8");
    await rename(temp, target);
    return record;
  }

  async getCursorRun(cursorRunId: string): Promise<CursorRunRecord | null> {
    try {
      const raw = await readFile(this.cursorRunPath(cursorRunId), "utf8");
      return JSON.parse(raw) as CursorRunRecord;
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === "ENOENT") return null;
      throw error;
    }
  }

  async listCursorRuns(taskId?: string): Promise<CursorRunRecord[]> {
    await this.ensureReady();
    const entries = await readdir(this.cursorRunsDir());
    const runs: CursorRunRecord[] = [];
    for (const entry of entries) {
      if (!entry.endsWith(".json")) continue;
      const run = await this.getCursorRun(entry.replace(/\.json$/, ""));
      if (!run) continue;
      if (taskId && run.taskId !== taskId) continue;
      runs.push(run);
    }
    return runs.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async saveReviewRun(
    run: Omit<ReviewRunRecord, "reviewRunId" | "createdAt"> & {
      reviewRunId?: string;
      createdAt?: string;
    },
  ): Promise<ReviewRunRecord> {
    await this.ensureReady();
    const record: ReviewRunRecord = {
      ...run,
      reviewRunId: run.reviewRunId ?? createReviewRunId(),
      createdAt: run.createdAt ?? new Date().toISOString(),
    };
    const target = this.reviewRunPath(record.reviewRunId);
    const temp = `${target}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(temp, `${JSON.stringify(record, null, 2)}\n`, "utf8");
    await rename(temp, target);
    return record;
  }

  async getReviewRun(reviewRunId: string): Promise<ReviewRunRecord | null> {
    try {
      const raw = await readFile(this.reviewRunPath(reviewRunId), "utf8");
      return JSON.parse(raw) as ReviewRunRecord;
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === "ENOENT") return null;
      throw error;
    }
  }

  async listReviewRuns(taskId?: string): Promise<ReviewRunRecord[]> {
    await this.ensureReady();
    const entries = await readdir(this.reviewRunsDir());
    const runs: ReviewRunRecord[] = [];
    for (const entry of entries) {
      if (!entry.endsWith(".json")) continue;
      const run = await this.getReviewRun(entry.replace(/\.json$/, ""));
      if (!run) continue;
      if (taskId && run.taskId !== taskId) continue;
      runs.push(run);
    }
    return runs.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async saveValidationRun(
    run: Omit<ValidationRunRecord, "validationRunId" | "createdAt"> & {
      validationRunId?: string;
      createdAt?: string;
    },
  ): Promise<ValidationRunRecord> {
    await this.ensureReady();
    const record: ValidationRunRecord = {
      ...run,
      validationRunId: run.validationRunId ?? createValidationRunId(),
      createdAt: run.createdAt ?? new Date().toISOString(),
    };
    const target = this.validationRunPath(record.validationRunId);
    const temp = `${target}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(temp, `${JSON.stringify(record, null, 2)}\n`, "utf8");
    await rename(temp, target);
    return record;
  }

  async getValidationRun(validationRunId: string): Promise<ValidationRunRecord | null> {
    try {
      const raw = await readFile(this.validationRunPath(validationRunId), "utf8");
      return JSON.parse(raw) as ValidationRunRecord;
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === "ENOENT") return null;
      throw error;
    }
  }

  async saveTaskRun(
    run: Omit<TaskRunRecord, "runId" | "createdAt" | "updatedAt"> & {
      runId?: string;
      createdAt?: string;
      updatedAt?: string;
    },
  ): Promise<TaskRunRecord> {
    await this.ensureReady();
    const now = new Date().toISOString();
    const record: TaskRunRecord = {
      ...run,
      runId: run.runId ?? createTaskRunId(),
      createdAt: run.createdAt ?? now,
      updatedAt: run.updatedAt ?? now,
    };
    await this.writeJsonAtomic(this.taskRunPath(record.runId), record);
    return record;
  }

  async getTaskRun(runId: string): Promise<TaskRunRecord | null> {
    try {
      const raw = await readFile(this.taskRunPath(runId), "utf8");
      return JSON.parse(raw) as TaskRunRecord;
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === "ENOENT") return null;
      throw error;
    }
  }

  async updateTaskRun(runId: string, patch: Partial<TaskRunRecord>): Promise<TaskRunRecord> {
    const existing = await this.getTaskRun(runId);
    if (!existing) throw new Error(`TaskRun not found: ${runId}`);
    const next: TaskRunRecord = {
      ...existing,
      ...patch,
      runId: existing.runId,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };
    await this.writeJsonAtomic(this.taskRunPath(runId), next);
    return next;
  }

  async listTaskRuns(taskId?: string): Promise<TaskRunRecord[]> {
    await this.ensureReady();
    const entries = await readdir(this.taskRunsDir());
    const runs: TaskRunRecord[] = [];
    for (const entry of entries) {
      if (!entry.endsWith(".json")) continue;
      const run = await this.getTaskRun(entry.replace(/\.json$/, ""));
      if (!run) continue;
      if (taskId && run.taskId !== taskId) continue;
      runs.push(run);
    }
    return runs.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async findActiveTaskRun(): Promise<TaskRunRecord | null> {
    const runs = await this.listTaskRuns();
    return (
      runs
        .filter((r) => r.status === "RUNNING" || r.status === "PENDING")
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null
    );
  }

  async appendRunEvent(
    event: Omit<RunEventRecord, "eventId" | "timestamp"> & {
      eventId?: string;
      timestamp?: string;
    },
  ): Promise<RunEventRecord> {
    await this.ensureReady();
    const record: RunEventRecord = {
      ...event,
      eventId: event.eventId ?? createRunEventId(),
      timestamp: event.timestamp ?? new Date().toISOString(),
    };
    await this.writeJsonAtomic(this.runEventPath(record.eventId), record);
    return record;
  }

  async listRunEvents(runId: string): Promise<RunEventRecord[]> {
    await this.ensureReady();
    const entries = await readdir(this.runEventsDir());
    const events: RunEventRecord[] = [];
    for (const entry of entries) {
      if (!entry.endsWith(".json")) continue;
      try {
        const raw = await readFile(join(this.runEventsDir(), entry), "utf8");
        const event = JSON.parse(raw) as RunEventRecord;
        if (event.runId === runId) events.push(event);
      } catch {
        // skip corrupt
      }
    }
    return events.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  async saveApprovalRequest(
    req: Omit<ApprovalRequestRecord, "approvalRequestId" | "createdAt"> & {
      approvalRequestId?: string;
      createdAt?: string;
    },
  ): Promise<ApprovalRequestRecord> {
    await this.ensureReady();
    const record: ApprovalRequestRecord = {
      ...req,
      approvalRequestId: req.approvalRequestId ?? createApprovalRequestId(),
      createdAt: req.createdAt ?? new Date().toISOString(),
    };
    await this.writeJsonAtomic(this.approvalPath(record.approvalRequestId), record);
    return record;
  }

  async getApprovalRequest(id: string): Promise<ApprovalRequestRecord | null> {
    try {
      const raw = await readFile(this.approvalPath(id), "utf8");
      return JSON.parse(raw) as ApprovalRequestRecord;
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === "ENOENT") return null;
      throw error;
    }
  }

  /** Test helper — delete a task file. */
  async deleteTask(taskId: string): Promise<void> {
    try {
      await unlink(this.taskPath(taskId));
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code !== "ENOENT") throw error;
    }
  }

  private async writeJsonAtomic(target: string, value: unknown): Promise<void> {
    await this.ensureReady();
    const temp = `${target}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    await rename(temp, target);
  }

  private async writeTaskAtomic(task: Task): Promise<void> {
    await this.writeJsonAtomic(this.taskPath(task.taskId), task);
  }
}
