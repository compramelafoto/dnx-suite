import type { OrchConfig } from "../config/env.js";
import { JsonTaskStore } from "../state/store.js";
import type { Task } from "../state/types.js";
import { WorktreeManager } from "./worktree.js";

export type PrepareTaskResult = {
  ok: boolean;
  code: "PREPARED" | "ALREADY_PREPARED" | "TASK_NOT_FOUND" | "INVALID_STATUS" | "FAILED";
  message: string;
  task: Task | null;
};

export async function prepareTaskWorktree(
  store: JsonTaskStore,
  config: OrchConfig,
  controlPlaneRoot: string,
  taskId: string,
  options: { baseRef?: string } = {},
): Promise<PrepareTaskResult> {
  const task = await store.getTask(taskId);
  if (!task) {
    return {
      ok: false,
      code: "TASK_NOT_FOUND",
      message: `Task not found: ${taskId}`,
      task: null,
    };
  }

  if (task.worktree && task.branch && task.baseCommit) {
    return {
      ok: true,
      code: "ALREADY_PREPARED",
      message: "Task worktree already prepared",
      task,
    };
  }

  if (!["PLANNING", "READY", "VALIDATING", "BLOCKED"].includes(task.status)) {
    return {
      ok: false,
      code: "INVALID_STATUS",
      message: `Task status ${task.status} cannot be prepared`,
      task,
    };
  }

  const worktreeRoot = WorktreeManager.resolveWorktreeRoot(
    controlPlaneRoot,
    config.worktreeRootEnv,
  );
  const manager = new WorktreeManager(controlPlaneRoot, worktreeRoot);

  try {
    const baseRef = options.baseRef?.trim() || config.defaultBaseRef;
    const prepared = await manager.createTaskWorktree({
      taskId: task.taskId,
      project: task.project,
      objective: task.objective,
      baseRef,
    });

    const updated = await store.updateTask(task.taskId, {
      branch: prepared.branch,
      worktree: prepared.worktree,
      baseRef: prepared.baseRef,
      baseCommit: prepared.baseCommit,
      status: task.status === "PLANNING" ? "READY" : task.status,
      lastError: null,
    });

    return {
      ok: true,
      code: "PREPARED",
      message: `Worktree prepared at ${prepared.worktree}`,
      task: updated,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await store.updateTask(task.taskId, {
      status: "BLOCKED",
      lastError: message,
    });
    return {
      ok: false,
      code: "FAILED",
      message,
      task: await store.getTask(task.taskId),
    };
  }
}
