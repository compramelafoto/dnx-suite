import { mkdtemp, mkdir, symlink, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { defaultWorktreeRoot } from "../src/config/defaults.js";
import { buildTaskBranchName, sanitizeSlug, validateBranchName } from "../src/git/branch.js";
import {
  assertNotControlPlaneWorkspace,
  assertPathInsideWorktreeRoot,
} from "../src/git/paths.js";
import { WorktreeManager } from "../src/git/worktree.js";
import { gitOk } from "../src/git/exec.js";

describe("worktree root and branch sanitization", () => {
  it("resolves sibling worktree root", () => {
    expect(defaultWorktreeRoot("/repo/dnx-suite")).toBe("/repo/dnx-orchestrator-worktrees");
    expect(WorktreeManager.resolveWorktreeRoot("/repo/dnx-suite")).toBe(
      "/repo/dnx-orchestrator-worktrees",
    );
    expect(WorktreeManager.resolveWorktreeRoot("/repo/dnx-suite", "/custom/wt")).toBe("/custom/wt");
  });

  it("sanitizes slug and builds branch", () => {
    expect(sanitizeSlug("Clickatón Social!!")).toBe("clickaton-social");
    const branch = buildTaskBranchName("task-1", "clickaton", "Social Feed");
    expect(branch.startsWith("dnx-orch/task-1-")).toBe(true);
    expect(validateBranchName(branch).ok).toBe(true);
    expect(validateBranchName("../evil").ok).toBe(false);
  });
});

describe("path containment", () => {
  const dirs: string[] = [];
  afterEach(async () => {
    await Promise.all(dirs.splice(0).map((d) => rm(d, { recursive: true, force: true })));
  });

  it("accepts paths inside root and rejects traversal", async () => {
    const root = await mkdtemp(join(tmpdir(), "orch-root-"));
    dirs.push(root);
    const inside = join(root, "task-1");
    await mkdir(inside);
    const ok = await assertPathInsideWorktreeRoot(inside, root);
    expect(ok.ok).toBe(true);

    const escape = await assertPathInsideWorktreeRoot(join(root, "..", "outside"), root);
    expect(escape.ok).toBe(false);
  });

  it("rejects symlink escape", async () => {
    const root = await mkdtemp(join(tmpdir(), "orch-root-"));
    const outside = await mkdtemp(join(tmpdir(), "orch-out-"));
    dirs.push(root, outside);
    await writeFile(join(outside, "secret.txt"), "x");
    const link = join(root, "escape-link");
    await symlink(outside, link);
    const result = await assertPathInsideWorktreeRoot(link, root);
    // realpath of symlink resolves outside → reject
    expect(result.ok).toBe(false);
  });

  it("rejects control-plane workspace", async () => {
    const root = await mkdtemp(join(tmpdir(), "orch-cp-"));
    dirs.push(root);
    const result = await assertNotControlPlaneWorkspace(root, root);
    expect(result.ok).toBe(false);
  });
});

describe("WorktreeManager with temp git repo", () => {
  const dirs: string[] = [];
  afterEach(async () => {
    await Promise.all(dirs.splice(0).map((d) => rm(d, { recursive: true, force: true })));
  });

  it("prepares worktree from concrete commit without dirty files", async () => {
    const repo = await mkdtemp(join(tmpdir(), "orch-repo-"));
    const wtRoot = await mkdtemp(join(tmpdir(), "orch-wt-"));
    dirs.push(repo, wtRoot);

    await gitOk(["init"], { cwd: repo });
    await gitOk(["config", "user.email", "test@example.com"], { cwd: repo });
    await gitOk(["config", "user.name", "Test"], { cwd: repo });
    await writeFile(join(repo, "README.md"), "hello\n");
    await gitOk(["add", "README.md"], { cwd: repo });
    await gitOk(["commit", "-m", "init"], { cwd: repo });
    const baseCommit = await gitOk(["rev-parse", "HEAD"], { cwd: repo });

    // Dirty control plane file must NOT appear in worktree.
    await writeFile(join(repo, "dirty.txt"), "dirty\n");

    const mgr = new WorktreeManager(repo, wtRoot);
    const prepared = await mgr.createTaskWorktree({
      taskId: "task-demo-1",
      project: "clickaton",
      objective: "demo",
      baseRef: "HEAD",
    });

    expect(prepared.baseCommit).toBe(baseCommit);
    expect(prepared.worktree.includes("task-demo-1")).toBe(true);
    const inspect = await mgr.inspectTaskWorktree(prepared.worktree);
    expect(inspect.exists).toBe(true);
    expect(inspect.clean).toBe(true);
    expect(inspect.statusPorcelain).not.toContain("dirty.txt");
  });
});
