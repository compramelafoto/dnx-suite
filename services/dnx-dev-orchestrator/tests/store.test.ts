import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { JsonTaskStore } from "../src/state/store.js";

describe("task creation and JSON persistence", () => {
  const dirs: string[] = [];

  afterEach(async () => {
    await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it("creates, lists, updates tasks and stages atomically", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "dnx-orch-"));
    dirs.push(dataDir);
    const store = new JsonTaskStore(dataDir);

    const task = await store.createTask({
      project: "clickaton",
      objective: "Scaffold only",
      budgetUsd: 5,
      maxIterations: 20,
    });

    expect(task.taskId).toMatch(/^task-\d{8}-\d{6}-[a-f0-9]+$/);
    expect(task.status).toBe("PLANNING");

    const loaded = await store.getTask(task.taskId);
    expect(loaded?.objective).toBe("Scaffold only");

    const { stage } = await store.createStage({
      taskId: task.taskId,
      title: "Stage 1",
      prompt: "Do nothing destructive",
    });
    expect(stage.stageNumber).toBe(1);

    await store.updateStage(task.taskId, stage.stageId, { status: "COMPLETED", costUsd: 0.1 });
    const stages = await store.getStagesForTask(task.taskId);
    expect(stages[0]?.status).toBe("COMPLETED");
    expect(stages[0]?.costUsd).toBe(0.1);

    const listed = await store.listTasks();
    expect(listed).toHaveLength(1);
  });
});
